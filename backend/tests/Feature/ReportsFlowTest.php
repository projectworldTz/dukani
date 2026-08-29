<?php

namespace Tests\Feature;

use App\Models\Branch;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Exercises Phase 5: dashboard summary, sales trend, and top-products aggregates. */
class ReportsFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_dashboard_summary_and_trend_reflect_a_completed_sale(): void
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
            'branch_id' => $branch->id, 'quantity_change' => 5, 'type' => 'opening_stock',
        ])->assertCreated();

        $api()->postJson('/api/v1/shifts/open', ['branch_id' => $branch->id, 'opening_cash' => 0])->assertCreated();
        $cashId = collect($api()->getJson('/api/v1/payment-methods')->json())->firstWhere('type', 'cash')['id'];

        $api()->postJson('/api/v1/sales', [
            'branch_id' => $branch->id,
            'items' => [['product_id' => $product['id'], 'quantity' => 2]],
            'payments' => [['payment_method_id' => $cashId, 'amount' => 40000]],
        ])->assertCreated();

        $summary = $api()->getJson('/api/v1/reports/dashboard-summary')->assertOk()->json();
        $this->assertEquals(40000, $summary['todays_sales']);
        $this->assertEquals(40000, $summary['cash_sales']);
        $this->assertSame(1, $summary['transactions_count']);

        $trend = $api()->getJson('/api/v1/reports/sales-trend')->assertOk()->json();
        $this->assertEquals(40000, $trend[0]['revenue']);
        $this->assertEquals(10000, $trend[0]['profit']); // (20000-15000)*2

        $top = $api()->getJson('/api/v1/reports/top-products')->assertOk()->json();
        $this->assertSame('Cooking Oil 5L', $top['best_selling'][0]['product_name']);
        $this->assertSame(2, $top['best_selling'][0]['quantity_sold']);

        // The period filter — additive fields alongside the always-present ones above.
        $todayPeriod = $api()->getJson('/api/v1/reports/dashboard-summary?period=today')->assertOk()->json();
        $this->assertSame('today', $todayPeriod['period']);
        $this->assertEquals(40000, $todayPeriod['period_revenue']);
        $this->assertEquals(10000, $todayPeriod['period_profit']);
        $this->assertSame(1, $todayPeriod['period_transactions_count']);
        $this->assertEquals(40000, $todayPeriod['period_cash_sales']);

        $yearPeriod = $api()->getJson('/api/v1/reports/dashboard-summary?period=year')->assertOk()->json();
        $this->assertSame('year', $yearPeriod['period']);
        $this->assertEquals(40000, $yearPeriod['period_revenue']);

        $trendToday = $api()->getJson('/api/v1/reports/sales-trend?period=today')->assertOk()->json();
        $this->assertCount(1, $trendToday);
        $this->assertEquals(40000, $trendToday[0]['revenue']);

        // "year"/"all" bucket by month rather than by day.
        $trendYear = $api()->getJson('/api/v1/reports/sales-trend?period=year')->assertOk()->json();
        $this->assertSame(now()->format('Y-m'), $trendYear[0]['date']);
        $this->assertEquals(40000, $trendYear[0]['revenue']);

        $topThisMonth = $api()->getJson('/api/v1/reports/top-products?period=month')->assertOk()->json();
        $this->assertSame('Cooking Oil 5L', $topThisMonth['best_selling'][0]['product_name']);
    }
}
