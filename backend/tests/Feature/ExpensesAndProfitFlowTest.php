<?php

namespace Tests\Feature;

use App\Models\Branch;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Exercises Phase 4: expense recording and profit calculation (spec §26/§27). */
class ExpensesAndProfitFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_expenses_reduce_net_profit_but_not_gross_profit(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'business_name' => 'Mama Nia Shop',
            'owner_name' => 'Nia Mwangi',
            'email' => 'nia@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])->assertCreated();
        $token = $response->json('token');
        $api = fn () => $this->withToken($token);
        $branch = Branch::firstOrFail();

        $product = $api()->postJson('/api/v1/products', [
            'name' => 'Cooking Oil 5L', 'cost_price' => 15000, 'selling_price' => 20000,
        ])->assertCreated()->json();
        $api()->postJson("/api/v1/products/{$product['id']}/stock/adjust", [
            'branch_id' => $branch->id, 'quantity_change' => 10, 'type' => 'opening_stock',
        ])->assertCreated();

        $api()->postJson('/api/v1/shifts/open', ['branch_id' => $branch->id, 'opening_cash' => 0])->assertCreated();
        $cashId = collect($api()->getJson('/api/v1/payment-methods')->json())->firstWhere('type', 'cash')['id'];

        // 20000 - 15000 = 5000 gross profit for this sale.
        $api()->postJson('/api/v1/sales', [
            'branch_id' => $branch->id,
            'items' => [['product_id' => $product['id'], 'quantity' => 1]],
            'payments' => [['payment_method_id' => $cashId, 'amount' => 20000]],
        ])->assertCreated();

        $category = $api()->postJson('/api/v1/expense-categories', ['name' => 'Rent'])->assertCreated()->json();
        $api()->postJson('/api/v1/expenses', [
            'expense_category_id' => $category['id'], 'amount' => 2000, 'date' => now()->toDateString(),
        ])->assertCreated();

        $profit = $api()->getJson('/api/v1/reports/profit')->assertOk()->json();

        $this->assertEquals(5000, $profit['gross_profit']);
        $this->assertEquals(2000, $profit['total_expenses']);
        $this->assertEquals(3000, $profit['net_profit']);

        $byProduct = $api()->getJson('/api/v1/reports/profit?group_by=product')->assertOk()->json();
        $this->assertEquals(5000, $byProduct[0]['gross_profit']);
        $this->assertSame('Cooking Oil 5L', $byProduct[0]['label']);
    }
}
