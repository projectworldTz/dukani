<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Exercises Phase 2: purchase receiving (partial then full delivery, spec §21),
 * supplier payments/outstanding balance, purchase returns, the full stock-transfer
 * workflow (spec §33, stock actually moving at dispatch/receive not at approval), and
 * stock-taking variance approval (spec §18) including the "approval uses live stock,
 * not the stale count-time snapshot" correctness fix in StockMovementService::correctTo().
 */
class PurchasingAndStockOpsFlowTest extends TestCase
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
        return $this->api()->postJson('/api/v1/products', [
            'name' => 'Cooking Oil 5L',
            'cost_price' => 15000,
            'selling_price' => 20000,
            ...$overrides,
        ])->assertCreated()->json();
    }

    private function createSupplier(): array
    {
        return $this->api()->postJson('/api/v1/suppliers', ['name' => 'ABC Wholesalers'])->assertCreated()->json();
    }

    public function test_partial_then_full_receiving_updates_stock_status_and_cost(): void
    {
        $product = $this->createProduct();
        $supplier = $this->createSupplier();

        $purchase = $this->api()->postJson('/api/v1/purchases', [
            'branch_id' => $this->mainBranch->id,
            'supplier_id' => $supplier['id'],
            'items' => [['product_id' => $product['id'], 'quantity_ordered' => 20, 'unit_cost' => 16000]],
        ])->assertCreated()->json();

        $itemId = $purchase['items'][0]['id'];

        // Partial delivery: 12 of 20.
        $afterPartial = $this->api()->postJson("/api/v1/purchases/{$purchase['id']}/receive", [
            'receipts' => [['purchase_item_id' => $itemId, 'quantity' => 12]],
        ])->assertOk()->json();

        $this->assertSame('partially_received', $afterPartial['status']);

        $inventory = $this->api()->getJson('/api/v1/inventory')->json('data');
        $this->assertSame(12, collect($inventory)->firstWhere('product.id', $product['id'])['quantity']);

        // Remaining 8.
        $afterFull = $this->api()->postJson("/api/v1/purchases/{$purchase['id']}/receive", [
            'receipts' => [['purchase_item_id' => $itemId, 'quantity' => 8]],
        ])->assertOk()->json();

        $this->assertSame('received', $afterFull['status']);

        // Cost price updated to the latest purchase cost ("last cost" costing).
        $this->assertEquals(16000, Product::find($product['id'])->cost_price);

        // Over-receiving beyond what's outstanding is rejected.
        $this->api()->postJson("/api/v1/purchases/{$purchase['id']}/receive", [
            'receipts' => [['purchase_item_id' => $itemId, 'quantity' => 1]],
        ])->assertStatus(422);
    }

    public function test_supplier_payment_reduces_outstanding_balance(): void
    {
        $product = $this->createProduct();
        $supplier = $this->createSupplier();

        $purchase = $this->api()->postJson('/api/v1/purchases', [
            'branch_id' => $this->mainBranch->id,
            'supplier_id' => $supplier['id'],
            'items' => [['product_id' => $product['id'], 'quantity_ordered' => 10, 'unit_cost' => 1000]],
        ])->assertCreated()->json();

        $this->assertEquals(10000, $purchase['grand_total']);

        $suppliers = $this->api()->getJson('/api/v1/suppliers')->json();
        $this->assertEquals(10000, collect($suppliers)->firstWhere('id', $supplier['id'])['outstanding_balance']);

        $this->api()->postJson("/api/v1/purchases/{$purchase['id']}/payments", ['amount' => 4000])->assertCreated();

        $suppliers = $this->api()->getJson('/api/v1/suppliers')->json();
        $this->assertEquals(6000, collect($suppliers)->firstWhere('id', $supplier['id'])['outstanding_balance']);
    }

    public function test_purchase_return_decrements_stock_and_cannot_exceed_received_quantity(): void
    {
        $product = $this->createProduct();
        $supplier = $this->createSupplier();

        $purchase = $this->api()->postJson('/api/v1/purchases', [
            'branch_id' => $this->mainBranch->id,
            'supplier_id' => $supplier['id'],
            'items' => [['product_id' => $product['id'], 'quantity_ordered' => 10, 'unit_cost' => 1000]],
        ])->assertCreated()->json();
        $itemId = $purchase['items'][0]['id'];

        $this->api()->postJson("/api/v1/purchases/{$purchase['id']}/receive", [
            'receipts' => [['purchase_item_id' => $itemId, 'quantity' => 10]],
        ])->assertOk();

        // Can't return more than received.
        $this->api()->postJson("/api/v1/purchases/{$purchase['id']}/returns", [
            'reason' => 'Damaged',
            'items' => [['purchase_item_id' => $itemId, 'quantity' => 11]],
        ])->assertStatus(422);

        $this->api()->postJson("/api/v1/purchases/{$purchase['id']}/returns", [
            'reason' => 'Damaged on arrival',
            'items' => [['purchase_item_id' => $itemId, 'quantity' => 3]],
        ])->assertCreated();

        $inventory = $this->api()->getJson('/api/v1/inventory')->json('data');
        $this->assertSame(7, collect($inventory)->firstWhere('product.id', $product['id'])['quantity']);
    }

    public function test_stock_transfer_moves_quantity_only_after_dispatch_and_receive(): void
    {
        $product = $this->createProduct();
        $secondBranch = $this->api()->postJson('/api/v1/branches', ['name' => 'Kariakoo Branch', 'code' => 'KRK'])->assertCreated()->json();

        // Give the main branch 20 units of opening stock.
        $this->api()->postJson("/api/v1/products/{$product['id']}/stock/adjust", [
            'branch_id' => $this->mainBranch->id, 'quantity_change' => 20, 'type' => 'opening_stock',
        ])->assertCreated();

        $transfer = $this->api()->postJson('/api/v1/stock-transfers', [
            'from_branch_id' => $this->mainBranch->id,
            'to_branch_id' => $secondBranch['id'],
            'items' => [['product_id' => $product['id'], 'quantity' => 5]],
        ])->assertCreated()->json();

        $this->api()->postJson("/api/v1/stock-transfers/{$transfer['id']}/request")->assertOk();
        $this->api()->postJson("/api/v1/stock-transfers/{$transfer['id']}/approve")->assertOk();

        // Stock hasn't moved yet at approval — still 20 at source, 0 at destination.
        $inventory = collect($this->api()->getJson('/api/v1/inventory')->json('data'));
        $this->assertSame(20, $inventory->firstWhere('product.id', $product['id'])['quantity']);

        $this->api()->postJson("/api/v1/stock-transfers/{$transfer['id']}/dispatch")->assertOk();

        $inventory = collect($this->api()->getJson('/api/v1/inventory?branch_id='.$this->mainBranch->id)->json('data'));
        $this->assertSame(15, $inventory->firstWhere('product.id', $product['id'])['quantity']);

        $this->api()->postJson("/api/v1/stock-transfers/{$transfer['id']}/receive")->assertOk();

        $destinationInventory = collect($this->api()->getJson('/api/v1/inventory?branch_id='.$secondBranch['id'])->json('data'));
        $this->assertSame(5, $destinationInventory->firstWhere('product.id', $product['id'])['quantity']);

        // Can't cancel once it has already been received.
        $this->api()->postJson("/api/v1/stock-transfers/{$transfer['id']}/cancel")->assertStatus(422);
    }

    public function test_stock_take_approval_posts_variance_against_live_stock(): void
    {
        $product = $this->createProduct();

        $this->api()->postJson("/api/v1/products/{$product['id']}/stock/adjust", [
            'branch_id' => $this->mainBranch->id, 'quantity_change' => 10, 'type' => 'opening_stock',
        ])->assertCreated();

        $stockTake = $this->api()->postJson('/api/v1/stock-takes', [
            'branch_id' => $this->mainBranch->id,
            'product_ids' => [$product['id']],
        ])->assertCreated()->json();

        $this->assertSame(10, $stockTake['items'][0]['system_quantity']);

        // A sale happens AFTER the count snapshot but BEFORE approval — live stock is
        // now 9, even though the stock take's snapshot still says 10.
        $this->api()->postJson('/api/v1/shifts/open', ['branch_id' => $this->mainBranch->id, 'opening_cash' => 0])->assertCreated();
        $methods = $this->api()->getJson('/api/v1/payment-methods')->json();
        $cash = collect($methods)->firstWhere('type', 'cash')['id'];
        $this->api()->postJson('/api/v1/sales', [
            'branch_id' => $this->mainBranch->id,
            'items' => [['product_id' => $product['id'], 'quantity' => 1]],
            'payments' => [['payment_method_id' => $cash, 'amount' => 20000]],
        ])->assertCreated();

        // Physical count found 9 units (matches what actually happened).
        $this->api()->putJson("/api/v1/stock-takes/{$stockTake['id']}/counts", [
            'counts' => [['item_id' => $stockTake['items'][0]['id'], 'counted_quantity' => 9]],
        ])->assertOk();

        $this->api()->postJson("/api/v1/stock-takes/{$stockTake['id']}/submit")->assertOk();
        $this->api()->postJson("/api/v1/stock-takes/{$stockTake['id']}/approve")->assertOk();

        // No spurious adjustment was posted — live stock already correctly read 9, and
        // correctTo() targets live stock, so it stays 9 rather than drifting to some
        // other value derived from the stale system_quantity=10 snapshot.
        $inventory = collect($this->api()->getJson('/api/v1/inventory')->json('data'));
        $this->assertSame(9, $inventory->firstWhere('product.id', $product['id'])['quantity']);
    }

    public function test_receiving_a_batch_tracked_product_creates_an_expiring_batch(): void
    {
        $product = $this->createProduct(['has_expiry' => true, 'has_batch' => true]);
        $supplier = $this->createSupplier();

        $purchase = $this->api()->postJson('/api/v1/purchases', [
            'branch_id' => $this->mainBranch->id,
            'supplier_id' => $supplier['id'],
            'items' => [['product_id' => $product['id'], 'quantity_ordered' => 5, 'unit_cost' => 1000]],
        ])->assertCreated()->json();

        $this->api()->postJson("/api/v1/purchases/{$purchase['id']}/receive", [
            'receipts' => [[
                'purchase_item_id' => $purchase['items'][0]['id'],
                'quantity' => 5,
                'batch_number' => 'B-2026-01',
                'expiry_date' => now()->addDays(20)->toDateString(),
            ]],
        ])->assertOk();

        $expiring = $this->api()->getJson('/api/v1/product-batches?within_days=30')->json();
        $this->assertCount(1, $expiring);
        $this->assertSame('B-2026-01', $expiring[0]['batch_number']);
        $this->assertSame(5, $expiring[0]['quantity_remaining']);
    }
}
