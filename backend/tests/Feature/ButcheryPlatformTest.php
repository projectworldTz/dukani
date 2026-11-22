<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Inventory;
use App\Models\Product;
use App\Models\ProductCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ButcheryPlatformTest extends TestCase
{
    use RefreshDatabase;

    private string $token;

    private int $branchId;

    private ?int $shiftId = null;

    private function registerButchery(string $category = 'Butchery & Fresh Foods', string $email = 'nyama@example.com'): array
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'business_name' => 'Nyama Choma Point', 'business_category' => $category, 'owner_name' => 'Baraka',
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

    /** Weighed product: prices per kg, opening stock in grams. */
    private function meat(string $name, float $price, float $cost, int $grams = 0): int
    {
        return $this->api()->postJson('/api/v1/products', [
            'name' => $name, 'selling_price' => $price, 'cost_price' => $cost, 'sold_by_weight' => true,
            'opening_stock' => $grams, 'reorder_level' => 2000,
        ])->assertCreated()->json('id');
    }

    private function sell(array $items, float $pay)
    {
        $this->shiftId ??= $this->api()->postJson('/api/v1/shifts/open', ['branch_id' => $this->branchId, 'opening_cash' => 0])->assertCreated()->json('id');
        $shift = $this->shiftId;
        $cash = collect($this->api()->getJson('/api/v1/payment-methods')->json())->firstWhere('type', 'cash')['id'];

        return $this->api()->postJson('/api/v1/sales', [
            'branch_id' => $this->branchId, 'shift_id' => $shift, 'items' => $items,
            'payments' => [['payment_method_id' => $cash, 'amount' => $pay]],
        ]);
    }

    private function grams(int $productId): int
    {
        return (int) Inventory::where('product_id', $productId)->value('quantity');
    }

    public function test_butchery_registration_gets_its_platform_and_meat_categories(): void
    {
        $data = $this->registerButchery();
        $this->assertSame('butchery', $data['user']['business']['platform']);
        $this->assertTrue(ProductCategory::where('name', 'Goat')->exists());
    }

    public function test_weighed_items_are_priced_per_kg_on_grams_and_reports_stay_correct(): void
    {
        $this->registerButchery();
        $beef = $this->meat('Beef steak', 12000, 9000, 10000); // 10 kg
        $eggs = $this->api()->postJson('/api/v1/products', ['name' => 'Eggs (tray)', 'selling_price' => 9000, 'cost_price' => 7500, 'opening_stock' => 5])->json('id');

        $sale = $this->sell([['product_id' => $beef, 'quantity' => 2350], ['product_id' => $eggs, 'quantity' => 1]], 40000)->assertCreated();

        $this->assertEquals(28200, $sale->json('items.0.line_total'));   // 2.35 kg × 12,000
        $this->assertSame(1000, $sale->json('items.0.price_divisor'));
        $this->assertSame(1, $sale->json('items.1.price_divisor'));
        $this->assertEquals(37200, $sale->json('grand_total'));
        $this->assertEquals(2800, $sale->json('change_amount'));
        $this->assertSame(7650, $this->grams($beef));                     // 10 kg − 2.35 kg

        $summary = $this->api()->getJson('/api/v1/reports/dashboard-summary?period=today')->assertOk();
        $this->assertEquals(37200, $summary->json('period_revenue'));
        $this->assertEquals(7050 + 1500, $summary->json('period_profit')); // 2.35 × 3,000 + 1 × 1,500
        $this->assertEquals(round(7.65 * 9000 + 4 * 7500, 2), $summary->json('inventory_value'));

        $top = collect($this->api()->getJson('/api/v1/reports/top-products?period=today')->json('best_selling'));
        $this->assertEquals(2.35, $top->firstWhere('product_name', 'Beef steak')['quantity_sold']);

        $profit = $this->api()->getJson('/api/v1/reports/profit')->assertOk();
        $this->assertEquals(37200, $profit->json('revenue'));

        $this->api()->get("/api/v1/sales/{$sale->json('id')}/receipt.pdf")->assertOk();

        $this->assertEquals(2.35, $this->api()->getJson('/api/v1/butchery/summary')->json('sold_kg_today'));
    }

    public function test_cannot_sell_more_meat_than_is_on_the_hook(): void
    {
        $this->registerButchery();
        $goat = $this->meat('Goat leg', 14000, 10000, 1500);
        $this->sell([['product_id' => $goat, 'quantity' => 1600]], 30000)->assertUnprocessable();
        $this->sell([['product_id' => $goat, 'quantity' => 1500]], 21000)->assertCreated();
        $this->assertSame(0, $this->grams($goat));
    }

    public function test_carcass_breakdown_adds_cuts_and_spreads_cost_over_usable_weight(): void
    {
        $this->registerButchery();
        $leg = $this->meat('Goat leg', 14000, 0);
        $ribs = $this->meat('Goat ribs', 12000, 0);
        $offal = $this->meat('Goat offal', 6000, 0);

        $response = $this->api()->postJson('/api/v1/butchery/breakdowns', [
            'branch_id' => $this->branchId, 'description' => 'Goat from Pugu market',
            'carcass_weight_kg' => 20, 'total_cost' => 200000,
            'lines' => [
                ['product_id' => $leg, 'weight_kg' => 8],
                ['product_id' => $ribs, 'weight_kg' => 6],
                ['product_id' => $offal, 'weight_kg' => 2],
            ],
        ])->assertCreated();

        $this->assertEquals(12500, $response->json('cost_per_kg'));  // 200,000 ÷ 16 usable kg
        $this->assertEquals(80, $response->json('yield_percent'));
        $this->assertEquals(4, $response->json('loss_kg'));
        $this->assertSame(8000, $this->grams($leg));
        $this->assertSame(6000, $this->grams($ribs));
        $this->assertEquals(12500, Product::find($leg)->cost_price);

        // Cuts can't weigh more than the carcass, and must be weighed products.
        $this->api()->postJson('/api/v1/butchery/breakdowns', [
            'branch_id' => $this->branchId, 'description' => 'x', 'carcass_weight_kg' => 5, 'total_cost' => 1,
            'lines' => [['product_id' => $leg, 'weight_kg' => 6]],
        ])->assertUnprocessable()->assertJsonValidationErrors('lines');
        $eggs = $this->api()->postJson('/api/v1/products', ['name' => 'Eggs', 'selling_price' => 1, 'cost_price' => 1])->json('id');
        $this->api()->postJson('/api/v1/butchery/breakdowns', [
            'branch_id' => $this->branchId, 'description' => 'x', 'carcass_weight_kg' => 5, 'total_cost' => 1,
            'lines' => [['product_id' => $eggs, 'weight_kg' => 1]],
        ])->assertUnprocessable()->assertJsonValidationErrors('lines');

        $this->assertCount(1, $this->api()->getJson('/api/v1/butchery/breakdowns')->json('data'));
    }

    public function test_price_board_updates_many_prices_at_once(): void
    {
        $this->registerButchery();
        $a = $this->meat('Beef', 12000, 9000);
        $b = $this->meat('Chicken', 9000, 7000);

        $this->api()->postJson('/api/v1/butchery/prices', ['prices' => [
            ['product_id' => $a, 'selling_price' => 13000],
            ['product_id' => $b, 'selling_price' => 9000, 'cost_price' => 7200],
        ]])->assertOk()->assertJson(['updated' => 2]);

        $this->assertEquals(13000, Product::find($a)->selling_price);
        $this->assertEquals(7200, Product::find($b)->cost_price);
    }

    public function test_butchery_tools_are_not_available_to_other_platforms(): void
    {
        $this->registerButchery('Retail & Grocery', 'shop@example.com');
        $this->api()->getJson('/api/v1/butchery/summary')->assertNotFound();
        $this->api()->postJson('/api/v1/butchery/prices', ['prices' => []])->assertNotFound();
    }
}
