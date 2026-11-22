<?php

namespace Tests\Feature;

use App\Models\Branch;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Exercises Phase 3: customer credit sales bounded by the customer's own credit limit
 * (spec §23, gated by a dedicated sales.credit.apply permission — not implied by
 * sales.create), loyalty points earned/redeemed at checkout (spec §24), sales
 * returns/refunds that reduce the sale's own totals and restock sellable items (spec
 * §25), and converting a quotation into a sale using the quotation's own frozen
 * prices rather than live product prices (spec §31).
 */
class CustomersLoyaltyReturnsQuotationsFlowTest extends TestCase
{
    use RefreshDatabase;

    private string $ownerToken;

    private Branch $mainBranch;

    protected function setUp(): void
    {
        parent::setUp();

        $response = $this->postJson('/api/v1/auth/register', [
            'business_name' => 'Mama Nia Shop',
            'owner_name' => 'Nia Mwangi',
            'email' => 'nia@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])->assertCreated();

        $this->ownerToken = $response->json('token');
        $this->mainBranch = Branch::firstOrFail();
    }

    private function api()
    {
        return $this->withToken($this->ownerToken);
    }

    private function createProduct(array $overrides = []): array
    {
        $product = $this->api()->postJson('/api/v1/products', [
            'name' => 'Cooking Oil 5L', 'cost_price' => 15000, 'selling_price' => 20000, ...$overrides,
        ])->assertCreated()->json();

        $this->api()->postJson("/api/v1/products/{$product['id']}/stock/adjust", [
            'branch_id' => $this->mainBranch->id, 'quantity_change' => 50, 'type' => 'opening_stock',
        ])->assertCreated();

        return $product;
    }

    private function openShiftAndCashMethod(): int
    {
        $this->api()->postJson('/api/v1/shifts/open', ['branch_id' => $this->mainBranch->id, 'opening_cash' => 0])->assertCreated();
        $methods = $this->api()->getJson('/api/v1/payment-methods')->json();

        return collect($methods)->firstWhere('type', 'cash')['id'];
    }

    public function test_credit_sale_is_bounded_by_customer_credit_limit(): void
    {
        $product = $this->createProduct();
        $customer = $this->api()->postJson('/api/v1/customers', ['name' => 'Juma Retail', 'credit_limit' => 15000])->assertCreated()->json();
        $this->openShiftAndCashMethod();

        // 20000 due, customer has only 15000 of credit and pays nothing -> rejected.
        $this->api()->postJson('/api/v1/sales', [
            'branch_id' => $this->mainBranch->id,
            'customer_id' => $customer['id'],
            'items' => [['product_id' => $product['id'], 'quantity' => 1]],
            'payments' => [],
        ])->assertStatus(422);

        // Without a customer at all, no credit is possible.
        $this->api()->postJson('/api/v1/sales', [
            'branch_id' => $this->mainBranch->id,
            'items' => [['product_id' => $product['id'], 'quantity' => 1]],
            'payments' => [],
        ])->assertStatus(422);

        // Within the limit: pay 10000 cash, leave 10000 on credit.
        $cashMethod = $this->api()->getJson('/api/v1/payment-methods')->json();
        $cashId = collect($cashMethod)->firstWhere('type', 'cash')['id'];

        $sale = $this->api()->postJson('/api/v1/sales', [
            'branch_id' => $this->mainBranch->id,
            'customer_id' => $customer['id'],
            'items' => [['product_id' => $product['id'], 'quantity' => 1]],
            'payments' => [['payment_method_id' => $cashId, 'amount' => 10000]],
        ])->assertCreated()->json();

        $this->assertSame('completed', $sale['status']);
        $this->assertEquals(10000, $sale['outstanding_balance']);

        $customerShow = $this->api()->getJson("/api/v1/customers/{$customer['id']}")->json();
        $this->assertEquals(10000, $customerShow['outstanding_balance']);

        // Pay off the remaining balance.
        $this->api()->postJson("/api/v1/customers/{$customer['id']}/payments", [
            'sale_id' => $sale['id'], 'amount' => 10000,
        ])->assertCreated();

        $customerShow = $this->api()->getJson("/api/v1/customers/{$customer['id']}")->json();
        $this->assertEquals(0, $customerShow['outstanding_balance']);
    }

    public function test_cash_change_never_counts_as_credit_for_the_customer(): void
    {
        $product = $this->createProduct();
        $customer = $this->api()->postJson('/api/v1/customers', ['name' => 'Asha', 'credit_limit' => 15000])->assertCreated()->json();
        $cashId = $this->openShiftAndCashMethod();

        // Pays 25000 cash for a 20000 sale and gets 5000 change.
        $this->api()->postJson('/api/v1/sales', [
            'branch_id' => $this->mainBranch->id, 'customer_id' => $customer['id'],
            'items' => [['product_id' => $product['id'], 'quantity' => 1]],
            'payments' => [['payment_method_id' => $cashId, 'amount' => 25000]],
        ])->assertCreated();
        $this->assertEquals(0, $this->api()->getJson("/api/v1/customers/{$customer['id']}")->json('outstanding_balance'));

        // Then buys 20000 on credit paying 5000: owes 15000 — the earlier change doesn't reduce it.
        $this->api()->postJson('/api/v1/sales', [
            'branch_id' => $this->mainBranch->id, 'customer_id' => $customer['id'],
            'items' => [['product_id' => $product['id'], 'quantity' => 1]],
            'payments' => [['payment_method_id' => $cashId, 'amount' => 5000]],
        ])->assertCreated();
        $this->assertEquals(15000, $this->api()->getJson("/api/v1/customers/{$customer['id']}")->json('outstanding_balance'));

        // Credit limit is used up, so another credit sale is refused.
        $this->api()->postJson('/api/v1/sales', [
            'branch_id' => $this->mainBranch->id, 'customer_id' => $customer['id'],
            'items' => [['product_id' => $product['id'], 'quantity' => 1]],
            'payments' => [['payment_method_id' => $cashId, 'amount' => 15000]],
        ])->assertStatus(422);
    }

    public function test_loyalty_points_are_earned_and_can_be_redeemed(): void
    {
        $this->api()->putJson('/api/v1/business/settings', [
            'loyalty_enabled' => true, 'loyalty_spend_per_point' => 10000, 'loyalty_point_value' => 100,
        ])->assertOk();

        $product = $this->createProduct();
        $customer = $this->api()->postJson('/api/v1/customers', ['name' => 'Loyal Joe'])->assertCreated()->json();
        $cashId = $this->openShiftAndCashMethod();

        // 20000 spent / 10000 per point = 2 points earned.
        $sale = $this->api()->postJson('/api/v1/sales', [
            'branch_id' => $this->mainBranch->id,
            'customer_id' => $customer['id'],
            'items' => [['product_id' => $product['id'], 'quantity' => 1]],
            'payments' => [['payment_method_id' => $cashId, 'amount' => 20000]],
        ])->assertCreated()->json();

        $this->assertSame(2, $sale['loyalty_points_earned']);
        $customerShow = $this->api()->getJson("/api/v1/customers/{$customer['id']}")->json();
        $this->assertSame(2, $customerShow['loyalty_points']);

        // Redeem both points (2 x 100 = 200 off) on the next sale.
        $sale2 = $this->api()->postJson('/api/v1/sales', [
            'branch_id' => $this->mainBranch->id,
            'customer_id' => $customer['id'],
            'items' => [['product_id' => $product['id'], 'quantity' => 1]],
            'redeem_points' => 2,
            'payments' => [['payment_method_id' => $cashId, 'amount' => 19800]],
        ])->assertCreated()->json();

        $this->assertEquals(19800, $sale2['grand_total']);
        $this->assertSame(2, $sale2['loyalty_points_redeemed']);

        $customerShow = $this->api()->getJson("/api/v1/customers/{$customer['id']}")->json();
        $this->assertSame(1, $customerShow['loyalty_points']); // 2 earned - 2 redeemed + 1 earned from sale2
    }

    public function test_sale_return_restocks_sellable_items_and_reduces_sale_total(): void
    {
        $product = $this->createProduct();
        $cashId = $this->openShiftAndCashMethod();

        $sale = $this->api()->postJson('/api/v1/sales', [
            'branch_id' => $this->mainBranch->id,
            'items' => [['product_id' => $product['id'], 'quantity' => 3]],
            'payments' => [['payment_method_id' => $cashId, 'amount' => 60000]],
        ])->assertCreated()->json();

        $saleItemId = $this->saleItemIdFor($sale['id']);

        $this->api()->postJson("/api/v1/sales/{$sale['id']}/returns", [
            'reason' => 'Customer changed mind',
            'items' => [['sale_item_id' => $saleItemId, 'quantity' => 1, 'condition' => 'sellable']],
        ])->assertCreated();

        $inventory = collect($this->api()->getJson('/api/v1/inventory')->json('data'));
        // 50 opening - 3 sold + 1 returned = 48
        $this->assertSame(48, $inventory->firstWhere('product.id', $product['id'])['quantity']);

        $updatedSale = $this->api()->getJson("/api/v1/sales/{$sale['id']}")->json();
        $this->assertSame('partially_refunded', $updatedSale['status']);
        $this->assertEquals(40000, $updatedSale['grand_total']);
    }

    private function saleItemIdFor(int $saleId): int
    {
        return \App\Models\SaleItem::where('sale_id', $saleId)->firstOrFail()->id;
    }

    public function test_sale_return_on_a_discounted_line_refunds_the_net_not_gross_amount(): void
    {
        $product = $this->createProduct();
        $cashId = $this->openShiftAndCashMethod();

        // 2 x 20000 = 40000 gross, less a 10000 line discount -> 30000 net (15000/unit net).
        $sale = $this->api()->postJson('/api/v1/sales', [
            'branch_id' => $this->mainBranch->id,
            'items' => [['product_id' => $product['id'], 'quantity' => 2, 'discount_amount' => 10000]],
            'payments' => [['payment_method_id' => $cashId, 'amount' => 30000]],
        ])->assertCreated()->json();

        $this->assertEquals(30000, $sale['grand_total']);
        $saleItemId = $this->saleItemIdFor($sale['id']);

        // Returning 1 of the 2 units should refund the net per-unit price (15000),
        // not the gross unit_price (20000) — the discount applies to returned stock too.
        $return = $this->api()->postJson("/api/v1/sales/{$sale['id']}/returns", [
            'reason' => 'Customer changed mind',
            'items' => [['sale_item_id' => $saleItemId, 'quantity' => 1, 'condition' => 'sellable']],
        ])->assertCreated()->json();

        $this->assertEquals(15000, $return['total_refund']);

        $updatedSale = $this->api()->getJson("/api/v1/sales/{$sale['id']}")->json();
        $this->assertSame('partially_refunded', $updatedSale['status']);
        $this->assertEquals(15000, $updatedSale['grand_total']);
    }

    public function test_quotation_converts_to_sale_with_frozen_prices(): void
    {
        $product = $this->createProduct();

        $quotation = $this->api()->postJson('/api/v1/quotations', [
            'branch_id' => $this->mainBranch->id,
            'customer_name' => 'Walk-in',
            // Quoted at a special price different from the product's live selling_price.
            'items' => [['product_id' => $product['id'], 'quantity' => 2, 'unit_price' => 18000]],
        ])->assertCreated()->json();

        $this->assertEquals(36000, $quotation['grand_total']);

        // Live product price changes after the quote was given.
        $this->api()->putJson("/api/v1/products/{$product['id']}", ['selling_price' => 25000])->assertOk();

        $sale = $this->api()->postJson("/api/v1/quotations/{$quotation['id']}/convert")->assertCreated()->json();

        $this->assertSame('held', $sale['status']);
        $this->assertEquals(36000, $sale['grand_total'], 'Converted sale must keep the quoted price, not the live product price');

        $quotationAfter = $this->api()->getJson("/api/v1/quotations/{$quotation['id']}")->json();
        $this->assertSame('converted', $quotationAfter['status']);
    }

    public function test_quotation_can_be_edited_pdfed_and_duplicated_but_not_edited_once_converted(): void
    {
        $product = $this->createProduct();

        $quotation = $this->api()->postJson('/api/v1/quotations', [
            'branch_id' => $this->mainBranch->id,
            'customer_name' => 'Walk-in',
            'notes' => 'Original notes',
            'items' => [['product_id' => $product['id'], 'quantity' => 2]],
        ])->assertCreated()->json();

        // Editable while still a draft — payment terms and notes both update.
        $edited = $this->api()->putJson("/api/v1/quotations/{$quotation['id']}", [
            'payment_terms' => '50% deposit, balance on delivery.',
            'notes' => 'Updated notes',
        ])->assertOk()->json();
        $this->assertSame('50% deposit, balance on delivery.', $edited['payment_terms']);
        $this->assertSame('Updated notes', $edited['notes']);

        // The professional PDF endpoint renders for a live quotation.
        $this->api()->getJson("/api/v1/quotations/{$quotation['id']}/pdf")
            ->assertOk()->assertHeader('content-type', 'application/pdf');

        // Duplicating starts a fresh draft with its own number, independent of the original.
        $duplicate = $this->api()->postJson("/api/v1/quotations/{$quotation['id']}/duplicate")->assertCreated()->json();
        $this->assertSame('draft', $duplicate['status']);
        $this->assertNotEquals($quotation['quotation_number'], $duplicate['quotation_number']);
        $this->assertEquals($quotation['grand_total'], $duplicate['grand_total']);

        // Once converted, the original can no longer be edited.
        $this->api()->postJson("/api/v1/quotations/{$quotation['id']}/convert")->assertCreated();
        $this->api()->putJson("/api/v1/quotations/{$quotation['id']}", ['notes' => 'Too late'])->assertStatus(422);
    }
}
