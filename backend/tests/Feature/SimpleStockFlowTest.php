<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Business;
use App\Models\Inventory;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Simple mode's stock actions: opening stock on product creation, "Add stock" with a
 * new buying price, "Remove stock" for damaged goods, "Fix count" to an absolute
 * number, the low/out-of-stock product filters, and the advanced-features switch.
 */
class SimpleStockFlowTest extends TestCase
{
    use RefreshDatabase;

    private function registerBusiness(string $email = 'owner@example.com'): string
    {
        return $this->postJson('/api/v1/auth/register', [
            'business_name' => 'Duka la '.$email,
            'owner_name' => 'Owner',
            'email' => $email,
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])->assertCreated()->json('token');
    }

    private function stockOf(int $productId): int
    {
        return (int) Inventory::where('product_id', $productId)->sum('quantity');
    }

    public function test_product_can_be_created_with_opening_stock(): void
    {
        $token = $this->registerBusiness();

        $productId = $this->withToken($token)->postJson('/api/v1/products', [
            'name' => 'Soda', 'cost_price' => 600, 'selling_price' => 1000, 'opening_stock' => 24,
        ])->assertCreated()->json('id');

        $this->assertSame(24, $this->stockOf($productId));
        $this->assertDatabaseHas('stock_movements', ['product_id' => $productId, 'type' => 'opening_stock', 'quantity_change' => 24]);
    }

    public function test_add_remove_and_fix_count_flow(): void
    {
        $token = $this->registerBusiness();
        $branchId = Branch::firstOrFail()->id;
        $productId = $this->withToken($token)->postJson('/api/v1/products', [
            'name' => 'Sugar 1kg', 'cost_price' => 2500, 'selling_price' => 3000,
        ])->assertCreated()->json('id');

        // Add stock at a new supplier price → cost price follows.
        $this->withToken($token)->postJson("/api/v1/products/{$productId}/stock/adjust", [
            'branch_id' => $branchId, 'type' => 'purchase', 'quantity_change' => 50, 'unit_cost' => 2700,
        ])->assertCreated();
        $this->assertSame(50, $this->stockOf($productId));
        $this->assertEquals(2700, Product::find($productId)->cost_price);

        // Remove damaged items.
        $this->withToken($token)->postJson("/api/v1/products/{$productId}/stock/adjust", [
            'branch_id' => $branchId, 'type' => 'damaged', 'quantity_change' => -3,
        ])->assertCreated();
        $this->assertSame(47, $this->stockOf($productId));

        // Fix count to what is physically on the shelf.
        $this->withToken($token)->postJson("/api/v1/products/{$productId}/stock/adjust", [
            'branch_id' => $branchId, 'type' => 'adjustment', 'counted_quantity' => 45,
        ])->assertCreated()->assertJsonPath('quantity_change', -2);
        $this->assertSame(45, $this->stockOf($productId));

        // Direction mismatches are rejected.
        $this->withToken($token)->postJson("/api/v1/products/{$productId}/stock/adjust", [
            'branch_id' => $branchId, 'type' => 'purchase', 'quantity_change' => -5,
        ])->assertUnprocessable();
        $this->withToken($token)->postJson("/api/v1/products/{$productId}/stock/adjust", [
            'branch_id' => $branchId, 'type' => 'damaged', 'quantity_change' => 5,
        ])->assertUnprocessable();

        // Cannot remove more than is in stock.
        $this->withToken($token)->postJson("/api/v1/products/{$productId}/stock/adjust", [
            'branch_id' => $branchId, 'type' => 'lost', 'quantity_change' => -100,
        ])->assertUnprocessable();
        $this->assertSame(45, $this->stockOf($productId));
    }

    public function test_stock_cannot_be_adjusted_into_another_businesses_branch(): void
    {
        $this->registerBusiness('other@example.com');
        $foreignBranchId = Branch::firstOrFail()->id;

        $token = $this->registerBusiness('mine@example.com');
        $productId = $this->withToken($token)->postJson('/api/v1/products', [
            'name' => 'Rice', 'cost_price' => 1, 'selling_price' => 2,
        ])->assertCreated()->json('id');

        $this->withToken($token)->postJson("/api/v1/products/{$productId}/stock/adjust", [
            'branch_id' => $foreignBranchId, 'type' => 'purchase', 'quantity_change' => 5,
        ])->assertUnprocessable()->assertJsonValidationErrors('branch_id');
    }

    public function test_low_and_out_of_stock_filters(): void
    {
        $token = $this->registerBusiness();
        $branchId = Branch::firstOrFail()->id;

        $create = fn (string $name, int $stock) => $this->withToken($token)->postJson('/api/v1/products', [
            'name' => $name, 'cost_price' => 1, 'selling_price' => 2, 'reorder_level' => 5, 'opening_stock' => $stock,
        ])->assertCreated();

        $create('Plenty', 40);
        $create('Running Low', 3);
        $create('Empty', 0);

        $names = fn (string $stock) => collect($this->withToken($token)
            ->getJson("/api/v1/products?branch_id={$branchId}&stock={$stock}")
            ->assertOk()->json('data'))->pluck('name')->all();

        $this->assertSame(['Running Low'], $names('low'));
        $this->assertSame(['Empty'], $names('out'));
    }

    public function test_advanced_features_switch_is_off_by_default_and_can_be_toggled(): void
    {
        $token = $this->registerBusiness();

        $this->withToken($token)->getJson('/api/v1/auth/me')->assertJsonPath('business.advanced_features', false);

        $this->withToken($token)->putJson('/api/v1/business/settings', ['advanced_features' => true])
            ->assertOk()->assertJsonPath('settings.advanced_features', true);

        $this->assertTrue((bool) Business::firstOrFail()->settings->advanced_features);
    }
}
