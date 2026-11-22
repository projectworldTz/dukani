<?php

namespace Tests\Feature;

use App\Models\Branch;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * Reports must use the shop's own clock (Africa/Dar_es_Salaam, UTC+3 by default),
 * not UTC: a sale at 00:30 local time is a "today" sale even though it is still the
 * previous day in UTC.
 */
class ReportsTimezoneTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_after_midnight_sale_counts_as_today_on_the_shops_clock(): void
    {
        // 21:30 UTC on 10 March = 00:30 on 11 March in Dar es Salaam.
        Carbon::setTestNow(Carbon::parse('2026-03-10 21:30:00', 'UTC'));

        $token = $this->postJson('/api/v1/auth/register', [
            'business_name' => 'Night Shop', 'owner_name' => 'Owner', 'email' => 'night@example.com',
            'password' => 'password123', 'password_confirmation' => 'password123',
        ])->assertCreated()->json('token');
        $branchId = Branch::firstOrFail()->id;

        $productId = $this->withToken($token)->postJson('/api/v1/products', [
            'name' => 'Soda', 'cost_price' => 600, 'selling_price' => 1000, 'opening_stock' => 10,
        ])->assertCreated()->json('id');
        $shiftId = $this->withToken($token)->postJson('/api/v1/shifts/open', ['branch_id' => $branchId, 'opening_cash' => 0])->json('id');
        $methodId = $this->withToken($token)->getJson('/api/v1/payment-methods')->json('0.id');

        $this->withToken($token)->postJson('/api/v1/sales', [
            'branch_id' => $branchId, 'shift_id' => $shiftId,
            'items' => [['product_id' => $productId, 'quantity' => 2]],
            'payments' => [['payment_method_id' => $methodId, 'amount' => 2000]],
        ])->assertCreated();

        // Later the same local morning (09:00 in Dar es Salaam).
        Carbon::setTestNow(Carbon::parse('2026-03-11 06:00:00', 'UTC'));

        $summary = $this->withToken($token)->getJson('/api/v1/reports/dashboard-summary?period=today')->assertOk();
        $this->assertEquals(2000, $summary->json('period_revenue'));
        $this->assertEquals(1, $summary->json('period_transactions_count'));
        $this->assertEquals(2000, $summary->json('todays_sales'));
        $this->assertEquals(0, $summary->json('yesterdays_sales'));

        $trend = $this->withToken($token)->getJson('/api/v1/reports/sales-trend?from=2026-03-10&to=2026-03-11')->assertOk()->json();
        $this->assertSame([['date' => '2026-03-11', 'revenue' => 2000, 'profit' => 800, 'orders' => 1]], $trend);
    }
}
