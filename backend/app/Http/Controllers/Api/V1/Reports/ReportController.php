<?php

namespace App\Http\Controllers\Api\V1\Reports;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Expense;
use App\Models\Inventory;
use App\Models\Product;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\Supplier;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Spec §2/§3/§35/§36's dashboard + trend + insight requirements, trimmed to the KPIs
 * and breakdowns that matter most (a literal "100+ report library" is a cross-cutting
 * reporting-platform project of its own, not one phase) — everything here is a
 * read-only aggregate over data earlier phases already built, no new transactional
 * tables. Kept as a handful of methods on one controller rather than one class per
 * report: they're all thin query aggregations, not independent stateful features.
 */
class ReportController extends Controller
{
    private const PERIODS = ['today', 'week', 'month', 'year', 'all'];

    /**
     * Start-of-period through "now" for the dashboard's period filter. A null $from
     * means "all" — no lower bound, so callers must treat it as "don't filter" rather
     * than passing it straight into whereDate().
     */
    private function resolvePeriodRange(string $period): array
    {
        return match ($period) {
            'today' => [now()->startOfDay(), now()->endOfDay()],
            'week' => [now()->startOfWeek(), now()->endOfDay()],
            'year' => [now()->startOfYear(), now()->endOfDay()],
            'all' => [null, now()->endOfDay()],
            default => [now()->startOfMonth(), now()->endOfDay()],
        };
    }

    /** The Business Owner / Manager dashboard's core numbers (spec §2), one call. */
    public function dashboardSummary(Request $request)
    {
        abort_unless($request->user()->can('sales.view.all'), 403);
        $branchId = $request->integer('branch_id') ?: null;

        $today = now()->startOfDay();
        $yesterday = now()->subDay()->startOfDay();

        $salesTotal = fn (Carbon $from, ?Carbon $to = null) => Sale::where('status', 'completed')
            ->when($branchId, fn ($q) => $q->where('branch_id', $branchId))
            ->whereDate('completed_at', '>=', $from)
            ->when($to, fn ($q) => $q->whereDate('completed_at', '<=', $to))
            ->sum('grand_total');

        $completedSales = Sale::where('status', 'completed')->when($branchId, fn ($q) => $q->where('branch_id', $branchId));

        $paymentBreakdown = (clone $completedSales)
            ->join('payments', 'payments.sale_id', '=', 'sales.id')
            ->join('payment_methods', 'payment_methods.id', '=', 'payments.payment_method_id')
            ->selectRaw('payment_methods.type, COALESCE(SUM(payments.amount), 0) as total')
            ->groupBy('payment_methods.type')
            ->pluck('total', 'type');

        // The period filter (today/week/month/year/all) — additive, doesn't touch any
        // field above so existing callers/tests that don't pass ?period= are unaffected.
        $period = in_array($request->string('period')->toString(), self::PERIODS, true)
            ? $request->string('period')->toString()
            : 'month';
        [$periodFrom, $periodTo] = $this->resolvePeriodRange($period);

        $periodSales = fn () => Sale::where('status', 'completed')
            ->when($branchId, fn ($q) => $q->where('branch_id', $branchId))
            ->when($periodFrom, fn ($q) => $q->whereDate('completed_at', '>=', $periodFrom))
            ->whereDate('completed_at', '<=', $periodTo);

        $periodPaymentBreakdown = $periodSales()
            ->join('payments', 'payments.sale_id', '=', 'sales.id')
            ->join('payment_methods', 'payment_methods.id', '=', 'payments.payment_method_id')
            ->selectRaw('payment_methods.type, COALESCE(SUM(payments.amount), 0) as total')
            ->groupBy('payment_methods.type')
            ->pluck('total', 'type');

        $periodRevenueProfit = SaleItem::query()
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->where('sales.status', 'completed')
            ->when($branchId, fn ($q) => $q->where('sales.branch_id', $branchId))
            ->when($periodFrom, fn ($q) => $q->whereDate('sales.completed_at', '>=', $periodFrom))
            ->whereDate('sales.completed_at', '<=', $periodTo)
            ->selectRaw('COALESCE(SUM(sale_items.unit_price * sale_items.quantity - sale_items.discount_amount), 0) as revenue,
                COALESCE(SUM((sale_items.unit_price * sale_items.quantity - sale_items.discount_amount) - (sale_items.cost_price * sale_items.quantity)), 0) as profit')
            ->first();

        return [
            'todays_sales' => (float) $salesTotal($today),
            'yesterdays_sales' => (float) $salesTotal($yesterday, $today->copy()->subSecond()),
            'weekly_sales' => (float) $salesTotal(now()->startOfWeek()),
            'monthly_sales' => (float) $salesTotal(now()->startOfMonth()),
            'yearly_sales' => (float) $salesTotal(now()->startOfYear()),
            'transactions_count' => (clone $completedSales)->count(),
            'average_transaction_value' => round((float) (clone $completedSales)->avg('grand_total'), 2),
            'total_customers' => Customer::count(),
            'new_customers_this_month' => Customer::where('created_at', '>=', now()->startOfMonth())->count(),
            'low_stock_count' => Inventory::query()
                ->join('products', 'products.id', '=', 'inventories.product_id')
                ->whereRaw('inventories.quantity <= COALESCE(inventories.reorder_level, products.reorder_level)')
                ->where('inventories.quantity', '>', 0)
                ->count(),
            'out_of_stock_count' => Inventory::where('quantity', '<=', 0)->count(),
            'inventory_value' => round((float) Inventory::query()
                ->join('products', 'products.id', '=', 'inventories.product_id')
                ->sum(DB::raw('inventories.quantity * products.cost_price')), 2),
            'outstanding_customer_credit' => round((float) Customer::all()->sum(fn (Customer $c) => $c->outstandingBalance()), 2),
            'outstanding_supplier_payments' => round((float) Supplier::all()->sum(fn (Supplier $s) => $s->outstandingBalance()), 2),
            'cash_sales' => (float) ($paymentBreakdown['cash'] ?? 0),
            'mobile_money_sales' => (float) ($paymentBreakdown['mobile_money'] ?? 0),
            'card_sales' => (float) (($paymentBreakdown['card'] ?? 0) + ($paymentBreakdown['pos_terminal'] ?? 0)),
            'bank_transfer_sales' => (float) ($paymentBreakdown['bank_transfer'] ?? 0),
            'discounts_given' => round((float) (clone $completedSales)->sum('discount_total'), 2),
            'tax_collected' => round((float) (clone $completedSales)->sum('tax_total'), 2),
            'total_expenses_this_month' => round((float) Expense::when($branchId, fn ($q) => $q->where('branch_id', $branchId))
                ->where('date', '>=', now()->startOfMonth())->sum('amount'), 2),

            // Everything below reflects the ?period= filter (defaults to "month"); the
            // fields above stay fixed to their own named windows for backward
            // compatibility with existing callers.
            'period' => $period,
            'period_from' => $periodFrom?->toDateString(),
            'period_to' => $periodTo->toDateString(),
            'period_revenue' => round((float) $periodRevenueProfit->revenue, 2),
            'period_profit' => round((float) $periodRevenueProfit->profit, 2),
            'period_transactions_count' => $periodSales()->count(),
            'period_average_transaction_value' => round((float) ($periodSales()->avg('grand_total') ?? 0), 2),
            'period_tax_collected' => round((float) $periodSales()->sum('tax_total'), 2),
            'period_discounts_given' => round((float) $periodSales()->sum('discount_total'), 2),
            'period_expenses' => round((float) Expense::when($branchId, fn ($q) => $q->where('branch_id', $branchId))
                ->when($periodFrom, fn ($q) => $q->whereDate('date', '>=', $periodFrom))
                ->whereDate('date', '<=', $periodTo)->sum('amount'), 2),
            'period_cash_sales' => (float) ($periodPaymentBreakdown['cash'] ?? 0),
            'period_mobile_money_sales' => (float) ($periodPaymentBreakdown['mobile_money'] ?? 0),
            'period_card_sales' => (float) (($periodPaymentBreakdown['card'] ?? 0) + ($periodPaymentBreakdown['pos_terminal'] ?? 0)),
            'period_bank_transfer_sales' => (float) ($periodPaymentBreakdown['bank_transfer'] ?? 0),
            'period_new_customers' => Customer::when($periodFrom, fn ($q) => $q->where('created_at', '>=', $periodFrom))
                ->where('created_at', '<=', $periodTo)->count(),
        ];
    }

    /**
     * Revenue + gross profit for a date range, for the dashboard's trend chart.
     * Explicit from/to (the original contract) still work exactly as before; a
     * ?period= shorthand is additive — it derives from/to via resolvePeriodRange()
     * and, unless group_by is given explicitly, buckets by month instead of day for
     * "year"/"all" so a long range doesn't render as hundreds of daily points. Grouped
     * in PHP rather than in SQL (DATE_FORMAT vs strftime) to stay portable between the
     * sqlite dev database and Postgres in production.
     */
    public function salesTrend(Request $request)
    {
        abort_unless($request->user()->can('sales.view.all'), 403);

        $period = $request->string('period')->toString();
        $branchId = $request->integer('branch_id') ?: null;

        if ($request->filled('from') || $request->filled('to')) {
            $from = $request->date('from') ?? now()->subDays(29)->startOfDay();
            $to = $request->date('to') ?? now()->endOfDay();
            $groupBy = $request->string('group_by', 'day')->toString();
        } else {
            $resolvedPeriod = in_array($period, self::PERIODS, true) ? $period : 'month';
            [$periodFrom, $to] = $this->resolvePeriodRange($resolvedPeriod);
            $from = $periodFrom ?? Sale::where('status', 'completed')->min('completed_at') ?? now()->subYear()->startOfDay();
            $groupBy = $request->string('group_by', in_array($resolvedPeriod, ['year', 'all'], true) ? 'month' : 'day')->toString();
        }

        $rows = SaleItem::query()
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->where('sales.status', 'completed')
            ->whereDate('sales.completed_at', '>=', $from)
            ->whereDate('sales.completed_at', '<=', $to)
            ->when($branchId, fn ($q) => $q->where('sales.branch_id', $branchId))
            ->selectRaw("DATE(sales.completed_at) as date,
                COALESCE(SUM(sale_items.unit_price * sale_items.quantity - sale_items.discount_amount), 0) as revenue,
                COALESCE(SUM((sale_items.unit_price * sale_items.quantity - sale_items.discount_amount) - (sale_items.cost_price * sale_items.quantity)), 0) as profit")
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        $points = $rows->map(fn ($row) => [
            'date' => $row->date,
            'revenue' => round((float) $row->revenue, 2),
            'profit' => round((float) $row->profit, 2),
        ]);

        if ($groupBy === 'month') {
            return $points->groupBy(fn ($p) => substr($p['date'], 0, 7))
                ->map(fn ($group, $month) => [
                    'date' => $month,
                    'revenue' => round($group->sum('revenue'), 2),
                    'profit' => round($group->sum('profit'), 2),
                ])
                ->values();
        }

        return $points;
    }

    /** Best/lowest sellers by quantity and by revenue (spec §3's product insights). */
    public function topProducts(Request $request)
    {
        abort_unless($request->user()->can('sales.view.all'), 403);

        if ($request->filled('from') || $request->filled('to')) {
            $from = $request->date('from') ?? now()->subDays(29)->startOfDay();
            $to = $request->date('to') ?? now()->endOfDay();
        } else {
            $period = in_array($request->string('period')->toString(), self::PERIODS, true)
                ? $request->string('period')->toString()
                : null;
            [$periodFrom, $periodTo] = $period
                ? $this->resolvePeriodRange($period)
                : [now()->subDays(29)->startOfDay(), now()->endOfDay()];
            $from = $periodFrom ?? Sale::where('status', 'completed')->min('completed_at') ?? now()->subYear()->startOfDay();
            $to = $periodTo;
        }
        $limit = min($request->integer('limit', 10), 50);

        $rows = SaleItem::query()
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->where('sales.status', 'completed')
            ->whereDate('sales.completed_at', '>=', $from)
            ->whereDate('sales.completed_at', '<=', $to)
            ->selectRaw("sale_items.product_id, sale_items.product_name,
                SUM(sale_items.quantity) as quantity_sold,
                COALESCE(SUM(sale_items.unit_price * sale_items.quantity - sale_items.discount_amount), 0) as revenue")
            ->groupBy('sale_items.product_id', 'sale_items.product_name')
            ->get();

        return [
            'best_selling' => $rows->sortByDesc('quantity_sold')->take($limit)->values(),
            'lowest_selling' => $rows->sortBy('quantity_sold')->take($limit)->values(),
            'highest_revenue' => $rows->sortByDesc('revenue')->take($limit)->values(),
        ];
    }

    public function lowStock(Request $request)
    {
        abort_unless($request->user()->can('inventory.view'), 403);

        return Product::query()
            ->join('inventories', 'inventories.product_id', '=', 'products.id')
            ->whereRaw('inventories.quantity <= COALESCE(inventories.reorder_level, products.reorder_level)')
            ->selectRaw('products.id, products.name, products.sku, SUM(inventories.quantity) as total_quantity, products.reorder_level')
            ->groupBy('products.id', 'products.name', 'products.sku', 'products.reorder_level')
            ->orderBy('total_quantity')
            ->get();
    }

    /** Tax collected per period, split by day (spec §40's tax report). */
    public function taxReport(Request $request)
    {
        abort_unless($request->user()->can('sales.view.all'), 403);

        $from = $request->date('from') ?? now()->startOfMonth();
        $to = $request->date('to') ?? now()->endOfDay();

        $rows = Sale::where('status', 'completed')
            ->whereDate('completed_at', '>=', $from)
            ->whereDate('completed_at', '<=', $to)
            ->selectRaw('DATE(completed_at) as date, COALESCE(SUM(tax_total), 0) as tax_collected, COALESCE(SUM(grand_total), 0) as gross_sales')
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        return [
            'rows' => $rows,
            'total_tax_collected' => round((float) $rows->sum('tax_collected'), 2),
            'total_gross_sales' => round((float) $rows->sum('gross_sales'), 2),
        ];
    }
}
