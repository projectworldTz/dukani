<?php

namespace App\Http\Controllers\Api\V1\Reports;

use App\Http\Controllers\Api\V1\Reports\Concerns\UsesBusinessTime;
use App\Http\Controllers\Controller;
use App\Models\Expense;
use App\Models\SaleItem;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

/**
 * Spec §27: revenue - COGS - discounts = gross profit; gross profit - expenses = net
 * profit. sale_items already snapshots unit_price/discount_amount/cost_price at sale
 * time (spec §57), so this is a straight aggregate over existing data — no new
 * transactional tables needed, just a query. Net profit only makes sense at the
 * whole-business level (expenses aren't attributable to one product/category), so
 * group_by results only ever return gross profit.
 */
class ProfitReportController extends Controller
{
    use UsesBusinessTime;

    public function __invoke(Request $request)
    {
        abort_unless($request->user()->can('sales.view.all'), 403);

        $data = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'branch_id' => ['nullable', 'integer'],
            'group_by' => ['nullable', Rule::in(['none', 'product', 'category', 'branch'])],
        ]);

        $groupBy = $data['group_by'] ?? 'none';

        $base = SaleItem::query()
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->whereIn('sales.status', ['completed', 'partially_refunded'])
            ->when($data['from'] ?? null, fn ($q, $from) => $q->where('sales.completed_at', '>=', $this->utcStart(Carbon::parse($from, $this->tz()))))
            ->when($data['to'] ?? null, fn ($q, $to) => $q->where('sales.completed_at', '<=', $this->utcEnd(Carbon::parse($to, $this->tz()))))
            ->when($data['branch_id'] ?? null, fn ($q, $branchId) => $q->where('sales.branch_id', $branchId));

        $revenueExpr = '(sale_items.unit_price * sale_items.quantity / sale_items.price_divisor - sale_items.discount_amount)';
        $costExpr = '(sale_items.cost_price * sale_items.quantity / sale_items.price_divisor)';

        if ($groupBy === 'none') {
            $totals = (clone $base)->selectRaw("COALESCE(SUM({$revenueExpr}), 0) as revenue, COALESCE(SUM({$costExpr}), 0) as cost")->first();
            $revenue = (float) $totals->revenue;
            $cost = (float) $totals->cost;
            $grossProfit = $revenue - $cost;

            $expenseTotal = (float) Expense::query()
                ->when($data['from'] ?? null, fn ($q, $from) => $q->whereDate('date', '>=', $from))
                ->when($data['to'] ?? null, fn ($q, $to) => $q->whereDate('date', '<=', $to))
                ->when($data['branch_id'] ?? null, fn ($q, $branchId) => $q->where('branch_id', $branchId))
                ->sum('amount');

            return [
                'revenue' => round($revenue, 2),
                'cost_of_goods_sold' => round($cost, 2),
                'gross_profit' => round($grossProfit, 2),
                'gross_profit_margin' => $revenue > 0 ? round($grossProfit / $revenue * 100, 2) : 0,
                'total_expenses' => round($expenseTotal, 2),
                'net_profit' => round($grossProfit - $expenseTotal, 2),
            ];
        }

        $rows = match ($groupBy) {
            'product' => (clone $base)
                ->selectRaw("sale_items.product_id, sale_items.product_name as label, COALESCE(SUM({$revenueExpr}), 0) as revenue, COALESCE(SUM({$costExpr}), 0) as cost")
                ->groupBy('sale_items.product_id', 'sale_items.product_name')
                ->get(),
            'category' => (clone $base)
                ->leftJoin('products', 'products.id', '=', 'sale_items.product_id')
                ->leftJoin('product_categories', 'product_categories.id', '=', 'products.category_id')
                ->selectRaw("product_categories.id as category_id, COALESCE(product_categories.name, 'Uncategorized') as label, COALESCE(SUM({$revenueExpr}), 0) as revenue, COALESCE(SUM({$costExpr}), 0) as cost")
                ->groupBy('product_categories.id', 'product_categories.name')
                ->get(),
            'branch' => (clone $base)
                ->join('branches', 'branches.id', '=', 'sales.branch_id')
                ->selectRaw("branches.id as branch_id, branches.name as label, COALESCE(SUM({$revenueExpr}), 0) as revenue, COALESCE(SUM({$costExpr}), 0) as cost")
                ->groupBy('branches.id', 'branches.name')
                ->get(),
        };

        return $rows->map(function ($row) {
            $revenue = (float) $row->revenue;
            $cost = (float) $row->cost;
            $grossProfit = $revenue - $cost;

            return [
                ...collect($row)->except(['revenue', 'cost'])->toArray(),
                'revenue' => round($revenue, 2),
                'cost_of_goods_sold' => round($cost, 2),
                'gross_profit' => round($grossProfit, 2),
                'gross_profit_margin' => $revenue > 0 ? round($grossProfit / $revenue * 100, 2) : 0,
            ];
        })->sortByDesc('gross_profit')->values();
    }
}
