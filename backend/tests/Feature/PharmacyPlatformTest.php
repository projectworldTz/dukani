<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\ControlledDrugEntry;
use App\Models\Inventory;
use App\Models\Prescription;
use App\Models\ProductBatch;
use App\Models\ProductCategory;
use App\Models\SaleItemBatch;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PharmacyPlatformTest extends TestCase
{
    use RefreshDatabase;

    private string $token;

    private int $branchId;

    private int $shiftId;

    private int $cashMethodId;

    private function registerPharmacy(string $email = 'pharma@example.com', string $category = 'Pharmacy & Health'): array
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'business_name' => 'Afya Pharmacy', 'business_category' => $category, 'owner_name' => 'Dr. Neema',
            'email' => $email, 'password' => 'password123', 'password_confirmation' => 'password123',
        ])->assertCreated();

        $this->token = $response->json('token');
        $this->branchId = Branch::where('business_id', $response->json('user.business.id'))->value('id');

        return $response->json();
    }

    private function api(): static
    {
        return $this->withToken($this->token);
    }

    private function openShift(): void
    {
        $this->shiftId = $this->api()->postJson('/api/v1/shifts/open', ['branch_id' => $this->branchId, 'opening_cash' => 0])->assertCreated()->json('id');
        $this->cashMethodId = collect($this->api()->getJson('/api/v1/payment-methods')->json())->firstWhere('type', 'cash')['id'];
    }

    private function medicine(array $overrides = []): int
    {
        return $this->api()->postJson('/api/v1/products', [
            'name' => 'Panadol 500mg', 'generic_name' => 'Paracetamol', 'strength' => '500 mg', 'dosage_form' => 'tablet',
            'cost_price' => 50, 'selling_price' => 100, ...$overrides,
        ])->assertCreated()->json('id');
    }

    private function receive(int $productId, int $qty, string $batch, string $expiry): void
    {
        $this->api()->postJson("/api/v1/products/{$productId}/stock/adjust", [
            'branch_id' => $this->branchId, 'type' => 'purchase', 'quantity_change' => $qty, 'batch_number' => $batch, 'expiry_date' => $expiry,
        ])->assertCreated();
    }

    private function sell(int $productId, int $qty, array $extra = [])
    {
        return $this->api()->postJson('/api/v1/sales', [
            'branch_id' => $this->branchId, 'shift_id' => $this->shiftId,
            'items' => [['product_id' => $productId, 'quantity' => $qty, ...($extra['item'] ?? [])]],
            'payments' => [['payment_method_id' => $this->cashMethodId, 'amount' => 100 * $qty]],
            ...array_diff_key($extra, ['item' => 1]),
        ]);
    }

    private function stock(int $productId): int
    {
        return (int) Inventory::where('product_id', $productId)->where('branch_id', $this->branchId)->value('quantity');
    }

    public function test_pharmacy_registration_gets_the_pharmacy_platform_and_starter_categories(): void
    {
        $data = $this->registerPharmacy();
        $this->assertSame('pharmacy', $data['user']['business']['platform']);
        $this->assertGreaterThanOrEqual(10, ProductCategory::count());
        $this->assertTrue(ProductCategory::where('name', 'Antibiotics')->exists());

        $general = $this->postJson('/api/v1/auth/register', [
            'business_name' => 'Duka', 'business_category' => 'Retail & Grocery', 'owner_name' => 'A', 'email' => 'shop@example.com',
            'password' => 'password123', 'password_confirmation' => 'password123',
        ])->assertCreated();
        $this->assertSame('general', $general->json('user.business.platform'));
    }

    public function test_medicines_are_batch_tracked_and_need_batch_details_for_stock(): void
    {
        $this->registerPharmacy();

        $this->api()->postJson('/api/v1/products', ['name' => 'Amoxil', 'cost_price' => 1, 'selling_price' => 2, 'opening_stock' => 10])
            ->assertUnprocessable()->assertJsonValidationErrors(['opening_batch_number', 'opening_expiry_date']);

        $id = $this->medicine(['opening_stock' => 30, 'opening_batch_number' => 'PAN-01', 'opening_expiry_date' => now()->addYear()->toDateString()]);
        $product = $this->api()->getJson("/api/v1/products/{$id}")->json();
        $this->assertTrue($product['has_batch']);
        $this->assertSame('Paracetamol', $product['generic_name']);
        $this->assertSame(30, (int) ProductBatch::where('product_id', $id)->value('quantity_remaining'));

        // Adding stock without batch details, or an already-expired batch, is refused.
        $this->api()->postJson("/api/v1/products/{$id}/stock/adjust", ['branch_id' => $this->branchId, 'type' => 'purchase', 'quantity_change' => 5])
            ->assertUnprocessable()->assertJsonValidationErrors('batch_number');
        $this->api()->postJson("/api/v1/products/{$id}/stock/adjust", [
            'branch_id' => $this->branchId, 'type' => 'purchase', 'quantity_change' => 5, 'batch_number' => 'OLD', 'expiry_date' => now()->subDay()->toDateString(),
        ])->assertUnprocessable()->assertJsonValidationErrors('expiry_date');

        // Searching by generic name finds the brand.
        $this->assertSame('Panadol 500mg', $this->api()->getJson('/api/v1/products?search=paracet')->json('data.0.name'));
    }

    public function test_sales_take_the_nearest_expiry_first_and_record_batches_and_dosage(): void
    {
        $this->registerPharmacy();
        $this->openShift();
        $id = $this->medicine();
        $this->receive($id, 10, 'LATE', now()->addYears(2)->toDateString());
        $this->receive($id, 4, 'SOON', now()->addMonths(3)->toDateString());

        $sale = $this->sell($id, 6, ['item' => ['dosage_instructions' => '2 tablets 3 times daily after meals']])->assertCreated();

        $this->assertSame('2 tablets 3 times daily after meals', $sale->json('items.0.dosage_instructions'));
        $this->assertEqualsCanonicalizing(
            [['batch_number' => 'SOON', 'quantity' => 4], ['batch_number' => 'LATE', 'quantity' => 2]],
            collect($sale->json('items.0.batches'))->map(fn ($b) => ['batch_number' => $b['batch_number'], 'quantity' => $b['quantity']])->all(),
        );
        $this->assertSame(0, ProductBatch::where('batch_number', 'SOON')->value('quantity_remaining'));
        $this->assertSame(8, ProductBatch::where('batch_number', 'LATE')->value('quantity_remaining'));
        $this->assertSame(8, $this->stock($id));

        $this->api()->get("/api/v1/sales/{$sale->json('id')}/receipt.pdf")->assertOk();
    }

    public function test_expired_stock_cannot_be_sold_and_can_be_removed(): void
    {
        $this->registerPharmacy();
        $this->openShift();
        $id = $this->medicine();
        $this->receive($id, 5, 'GOOD', now()->addYear()->toDateString());
        $this->receive($id, 3, 'BAD', now()->addMonth()->toDateString());
        ProductBatch::where('batch_number', 'BAD')->update(['expiry_date' => now()->subDays(2)->toDateString()]);

        $this->sell($id, 6)->assertUnprocessable()->assertJsonFragment(['items' => ['Only 5 of "Panadol 500mg" can be sold — 3 more are expired and must be removed from stock.']]);
        $this->sell($id, 5)->assertCreated();

        $list = $this->api()->getJson("/api/v1/products?branch_id={$this->branchId}")->json('data.0');
        $this->assertSame(3, $list['expired_stock']);

        // "Remove expired" takes the expired batch out.
        $this->api()->postJson("/api/v1/products/{$id}/stock/adjust", ['branch_id' => $this->branchId, 'type' => 'expired', 'quantity_change' => -3])->assertCreated();
        $this->assertSame(0, ProductBatch::where('batch_number', 'BAD')->value('quantity_remaining'));
        $this->assertSame(0, $this->stock($id));

        $summary = $this->api()->getJson('/api/v1/pharmacy/summary')->assertOk()->json();
        $this->assertSame(0, $summary['expired_units']);
    }

    public function test_prescription_only_medicine_requires_a_prescription(): void
    {
        $this->registerPharmacy();
        $this->openShift();
        $id = $this->medicine(['name' => 'Amoxicillin 500mg', 'requires_prescription' => true]);
        $this->receive($id, 20, 'AMX-1', now()->addYear()->toDateString());

        $this->sell($id, 1)->assertUnprocessable()->assertJsonValidationErrors('prescription');
        $this->sell($id, 1, ['prescription' => ['patient_name' => 'Juma']])->assertUnprocessable()
            ->assertJsonFragment(['prescription' => ["A prescription is required for Amoxicillin 500mg. Please enter the prescriber's name and the prescription number."]]);

        $sale = $this->sell($id, 2, ['prescription' => [
            'rx_number' => 'RX-778', 'prescriber_name' => 'Dr. Mushi', 'patient_name' => 'Juma Ali', 'patient_age' => 34, 'facility' => 'Amana Hospital',
        ]])->assertCreated();
        $this->assertSame('RX-778', $sale->json('prescription.rx_number'));
        $this->assertSame(1, Prescription::count());

        $this->assertSame('Juma Ali', $this->api()->getJson('/api/v1/pharmacy/prescriptions?search=juma')->json('data.0.patient_name'));
    }

    public function test_controlled_medicines_are_written_to_the_register_with_running_balance(): void
    {
        $this->registerPharmacy();
        $this->openShift();
        $id = $this->medicine(['name' => 'Tramadol 50mg', 'is_controlled' => true, 'requires_prescription' => true]);
        $this->receive($id, 10, 'TRM-9', now()->addYear()->toDateString());

        $sale = $this->sell($id, 3, ['prescription' => ['rx_number' => 'RX-1', 'prescriber_name' => 'Dr. Kweka', 'patient_name' => 'Mary']])->assertCreated();
        $itemId = \App\Models\SaleItem::where('sale_id', $sale->json('id'))->value('id');

        $this->api()->postJson("/api/v1/sales/{$sale->json('id')}/returns", ['items' => [['sale_item_id' => $itemId, 'quantity' => 1, 'condition' => 'sellable']]])->assertCreated();

        $entries = ControlledDrugEntry::orderBy('id')->get(['type', 'quantity_in', 'quantity_out', 'balance_after', 'patient_name', 'prescriber_name'])->toArray();
        $this->assertSame([
            ['type' => 'received', 'quantity_in' => 10, 'quantity_out' => 0, 'balance_after' => 10, 'patient_name' => null, 'prescriber_name' => null],
            ['type' => 'dispensed', 'quantity_in' => 0, 'quantity_out' => 3, 'balance_after' => 7, 'patient_name' => 'Mary', 'prescriber_name' => 'Dr. Kweka'],
            ['type' => 'returned', 'quantity_in' => 1, 'quantity_out' => 0, 'balance_after' => 8, 'patient_name' => null, 'prescriber_name' => null],
        ], $entries);

        // The return went back into the batch it was dispensed from.
        $this->assertSame(8, ProductBatch::where('batch_number', 'TRM-9')->value('quantity_remaining'));
        $this->assertSame(1, SaleItemBatch::value('quantity_returned'));

        $this->assertCount(3, $this->api()->getJson("/api/v1/pharmacy/controlled-register?product_id={$id}")->json('data'));
    }

    public function test_fix_count_takes_shortfalls_from_batches_and_needs_a_batch_for_extras(): void
    {
        $this->registerPharmacy();
        $id = $this->medicine();
        $this->receive($id, 10, 'B1', now()->addYear()->toDateString());

        $this->api()->postJson("/api/v1/products/{$id}/stock/adjust", ['branch_id' => $this->branchId, 'type' => 'adjustment', 'counted_quantity' => 7])->assertCreated();
        $this->assertSame(7, ProductBatch::where('batch_number', 'B1')->value('quantity_remaining'));

        $this->api()->postJson("/api/v1/products/{$id}/stock/adjust", ['branch_id' => $this->branchId, 'type' => 'adjustment', 'counted_quantity' => 9])
            ->assertUnprocessable()->assertJsonValidationErrors('batch_number');
        $this->api()->postJson("/api/v1/products/{$id}/stock/adjust", [
            'branch_id' => $this->branchId, 'type' => 'adjustment', 'counted_quantity' => 9, 'batch_number' => 'B2', 'expiry_date' => now()->addMonths(8)->toDateString(),
        ])->assertCreated();
        $this->assertSame(9, $this->stock($id));
        $this->assertSame(2, ProductBatch::where('batch_number', 'B2')->value('quantity_remaining'));
    }

    public function test_stock_from_before_batch_tracking_can_still_be_sold(): void
    {
        $this->registerPharmacy();
        $this->openShift();
        $id = $this->medicine();
        // Simulate stock that existed before the pharmacy platform: inventory with no batches.
        Inventory::create(['business_id' => \App\Models\Business::value('id'), 'product_id' => $id, 'branch_id' => $this->branchId, 'quantity' => 4]);

        $this->sell($id, 3)->assertCreated();
        $this->assertSame(1, $this->stock($id));
        $this->assertNull(SaleItemBatch::value('product_batch_id'));
    }

    public function test_pharmacy_endpoints_are_not_available_to_general_shops(): void
    {
        $this->registerPharmacy('shop@example.com', 'Retail & Grocery');
        $this->api()->getJson('/api/v1/pharmacy/summary')->assertNotFound();
        $this->api()->getJson('/api/v1/pharmacy/prescriptions')->assertNotFound();

        // General shops keep the simple stock flow — no batch needed.
        $id = $this->api()->postJson('/api/v1/products', ['name' => 'Soda', 'cost_price' => 1, 'selling_price' => 2, 'opening_stock' => 5])->assertCreated()->json('id');
        $this->assertSame(5, $this->stock($id));
        $this->assertSame(0, ProductBatch::count());
    }

    public function test_transfers_carry_batches_and_controlled_register_to_the_other_branch(): void
    {
        $data = $this->registerPharmacy();
        $second = Branch::create(['business_id' => $data['user']['business']['id'], 'name' => 'Mbezi', 'code' => 'MBZ', 'is_main' => false, 'status' => 'active']);
        $id = $this->medicine(['name' => 'Tramadol 50mg', 'is_controlled' => true, 'requires_prescription' => true]);
        $this->receive($id, 10, 'LATE', now()->addYears(2)->toDateString());
        $this->receive($id, 4, 'SOON', now()->addMonths(3)->toDateString());

        $t = $this->api()->postJson('/api/v1/stock-transfers', [
            'from_branch_id' => $this->branchId, 'to_branch_id' => $second->id, 'items' => [['product_id' => $id, 'quantity' => 6]],
        ])->assertCreated()->json('id');
        foreach (['request', 'approve', 'dispatch', 'receive'] as $step) {
            $this->api()->postJson("/api/v1/stock-transfers/{$t}/{$step}")->assertOk();
        }

        // Nearest expiry leaves first; the receiving branch gets the same batches.
        $this->assertSame(0, ProductBatch::where('branch_id', $this->branchId)->where('batch_number', 'SOON')->value('quantity_remaining'));
        $this->assertSame(8, ProductBatch::where('branch_id', $this->branchId)->where('batch_number', 'LATE')->value('quantity_remaining'));
        $this->assertSame(4, ProductBatch::where('branch_id', $second->id)->where('batch_number', 'SOON')->value('quantity_remaining'));
        $this->assertSame(2, ProductBatch::where('branch_id', $second->id)->where('batch_number', 'LATE')->value('quantity_remaining'));
        $this->assertSame(8, $this->stock($id));
        $this->assertSame(6, (int) Inventory::where('product_id', $id)->where('branch_id', $second->id)->value('quantity'));

        $this->assertSame(8, ControlledDrugEntry::where('branch_id', $this->branchId)->latest('id')->value('balance_after'));
        $this->assertSame(6, ControlledDrugEntry::where('branch_id', $second->id)->latest('id')->value('balance_after'));
    }

    public function test_purchases_returns_and_stock_takes_keep_batches_in_step(): void
    {
        $this->registerPharmacy();
        $id = $this->medicine(['name' => 'Diazepam 5mg', 'is_controlled' => true, 'requires_prescription' => true]);
        $supplier = $this->api()->postJson('/api/v1/suppliers', ['name' => 'MSD'])->assertCreated()->json('id');

        $purchase = $this->api()->postJson('/api/v1/purchases', [
            'branch_id' => $this->branchId, 'supplier_id' => $supplier, 'items' => [['product_id' => $id, 'quantity_ordered' => 20, 'unit_cost' => 50]],
        ])->assertCreated()->json();
        $itemId = $purchase['items'][0]['id'];
        $this->api()->postJson("/api/v1/purchases/{$purchase['id']}/receive", [
            'receipts' => [['purchase_item_id' => $itemId, 'quantity' => 20, 'batch_number' => 'DZP-1', 'expiry_date' => now()->addYear()->toDateString()]],
        ])->assertOk();
        $this->receive($id, 5, 'DZP-OLD', now()->addMonth()->toDateString());
        ProductBatch::where('batch_number', 'DZP-OLD')->update(['expiry_date' => now()->subDay()->toDateString()]);

        // Returning to the supplier takes the expired batch first.
        $this->api()->postJson("/api/v1/purchases/{$purchase['id']}/returns", ['reason' => 'Expired', 'items' => [['purchase_item_id' => $itemId, 'quantity' => 3]]])->assertCreated();
        $this->assertSame(2, ProductBatch::where('batch_number', 'DZP-OLD')->value('quantity_remaining'));
        $this->assertSame(22, $this->stock($id));

        // A stock take shortfall also comes out of expired stock first.
        $take = $this->api()->postJson('/api/v1/stock-takes', ['branch_id' => $this->branchId, 'product_ids' => [$id]])->assertCreated()->json();
        $this->api()->putJson("/api/v1/stock-takes/{$take['id']}/counts", ['counts' => [['item_id' => $take['items'][0]['id'], 'counted_quantity' => 18]]])->assertOk();
        $this->api()->postJson("/api/v1/stock-takes/{$take['id']}/submit")->assertOk();
        $this->api()->postJson("/api/v1/stock-takes/{$take['id']}/approve")->assertOk();

        $this->assertSame(18, $this->stock($id));
        $this->assertSame(0, ProductBatch::where('batch_number', 'DZP-OLD')->value('quantity_remaining'));
        $this->assertSame(18, ProductBatch::where('batch_number', 'DZP-1')->value('quantity_remaining'));
        $this->assertSame(18, ControlledDrugEntry::latest('id')->value('balance_after'));
        $this->assertSame(['received', 'received', 'removed', 'adjusted'], ControlledDrugEntry::orderBy('id')->pluck('type')->all());
    }
}
