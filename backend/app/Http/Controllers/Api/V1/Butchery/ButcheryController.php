<?php

namespace App\Http\Controllers\Api\V1\Butchery;

use App\Http\Controllers\Controller;
use App\Models\CarcassBreakdown;
use App\Models\Product;
use App\Models\SaleItem;
use App\Services\Inventory\StockMovementService;
use App\Support\Butchery\ButcheryCatalog;
use App\Support\Tenancy\BusinessContext;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Butchery platform: the daily price board, cutting up a carcass into saleable cuts,
 * and the numbers a butcher checks each day (kilograms sold).
 */
class ButcheryController extends Controller
{
    public function __construct(private StockMovementService $stockMovementService) {}

    private function guard(Request $request): void
    {
        abort_unless($request->user()->business?->isButchery(), 404, 'This is only available on the butchery platform.');
    }

    public function summary(Request $request)
    {
        $this->guard($request);
        abort_unless($request->user()->can('sales.view.all') || $request->user()->can('inventory.view'), 403);

        $tz = $request->user()->business->timezone ?: config('app.timezone');
        $start = Carbon::now($tz)->startOfDay()->utc();
        $branchId = $request->integer('branch_id') ?: null;

        $soldGrams = (int) SaleItem::query()
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->where('sales.status', 'completed')
            ->where('sales.completed_at', '>=', $start)
            ->where('sale_items.price_divisor', ButcheryCatalog::GRAMS_PER_KG)
            ->when($branchId, fn ($q) => $q->where('sales.branch_id', $branchId))
            ->sum('sale_items.quantity');

        return [
            'sold_kg_today' => round($soldGrams / ButcheryCatalog::GRAMS_PER_KG, 3),
            'weighed_products' => Product::where('sold_by_weight', true)->count(),
            'breakdowns_this_week' => CarcassBreakdown::where('created_at', '>=', Carbon::now($tz)->startOfWeek()->utc())->count(),
        ];
    }

    /** Daily price board: update selling (and optionally buying) prices per kg in one go. */
    public function updatePrices(Request $request)
    {
        $this->guard($request);
        abort_unless($request->user()->can('products.manage'), 403);

        $data = $request->validate([
            'prices' => ['required', 'array', 'min:1', 'max:500'],
            'prices.*.product_id' => ['required', 'integer', Rule::exists('products', 'id')->where('business_id', BusinessContext::id())],
            'prices.*.selling_price' => ['required', 'numeric', 'min:0'],
            'prices.*.cost_price' => ['nullable', 'numeric', 'min:0'],
        ]);

        $updated = DB::transaction(function () use ($data) {
            $count = 0;
            foreach ($data['prices'] as $row) {
                $product = Product::findOrFail($row['product_id']);
                $changes = ['selling_price' => $row['selling_price']];
                if (isset($row['cost_price'])) {
                    $changes['cost_price'] = $row['cost_price'];
                }
                $product->fill($changes);
                if ($product->isDirty()) {
                    $product->save();
                    $count++;
                }
            }

            return $count;
        });

        return ['updated' => $updated];
    }

    public function breakdowns(Request $request)
    {
        $this->guard($request);
        abort_unless($request->user()->can('inventory.view'), 403);

        return CarcassBreakdown::with('creator:id,name')->orderByDesc('created_at')->paginate(min(max($request->integer('per_page', 20), 1), 100));
    }

    /**
     * Cut up a carcass: each cut is added to stock by weight, and every cut is costed
     * at the carcass cost spread over the usable (cut) weight — so bone and trim loss
     * is built into the cost per kg instead of silently eating the margin.
     */
    public function storeBreakdown(Request $request)
    {
        $this->guard($request);
        abort_unless($request->user()->can('inventory.adjust'), 403);
        $businessId = BusinessContext::id();

        $data = $request->validate([
            'branch_id' => ['required', 'integer', Rule::exists('branches', 'id')->where('business_id', $businessId)],
            'description' => ['required', 'string', 'max:255'],
            'carcass_weight_kg' => ['required', 'numeric', 'gt:0', 'max:5000'],
            'total_cost' => ['required', 'numeric', 'min:0'],
            'lines' => ['required', 'array', 'min:1', 'max:50'],
            'lines.*.product_id' => ['required', 'integer', 'distinct', Rule::exists('products', 'id')->where('business_id', $businessId)],
            'lines.*.weight_kg' => ['required', 'numeric', 'gt:0'],
        ]);

        $carcassGrams = (int) round($data['carcass_weight_kg'] * ButcheryCatalog::GRAMS_PER_KG);
        $lines = collect($data['lines'])->map(fn ($l) => [
            'product' => Product::findOrFail($l['product_id']),
            'grams' => (int) round($l['weight_kg'] * ButcheryCatalog::GRAMS_PER_KG),
        ]);
        $yieldGrams = $lines->sum('grams');

        if ($lines->contains(fn ($l) => ! $l['product']->sold_by_weight)) {
            throw ValidationException::withMessages(['lines' => 'Every cut must be a product sold by weight (kg).']);
        }
        if ($yieldGrams > $carcassGrams) {
            throw ValidationException::withMessages(['lines' => 'The cuts weigh more than the whole carcass. Check the weights.']);
        }

        $costPerKg = round((float) $data['total_cost'] / ($yieldGrams / ButcheryCatalog::GRAMS_PER_KG), 2);
        $user = $request->user();

        $breakdown = DB::transaction(function () use ($data, $lines, $carcassGrams, $yieldGrams, $costPerKg, $user) {
            foreach ($lines as $line) {
                $this->stockMovementService->adjust(
                    product: $line['product'],
                    branchId: (int) $data['branch_id'],
                    quantityChange: $line['grams'],
                    type: 'purchase',
                    reason: "Carcass cut: {$data['description']}",
                    userId: $user->id,
                );
                $line['product']->update(['cost_price' => $costPerKg]);
            }

            return CarcassBreakdown::create([
                'business_id' => BusinessContext::id(),
                'branch_id' => $data['branch_id'],
                'description' => $data['description'],
                'carcass_weight_g' => $carcassGrams,
                'total_cost' => $data['total_cost'],
                'yield_weight_g' => $yieldGrams,
                'cost_per_kg' => $costPerKg,
                'lines' => $lines->map(fn ($l) => ['product_id' => $l['product']->id, 'name' => $l['product']->name, 'weight_g' => $l['grams']])->values()->all(),
                'created_by' => $user->id,
            ]);
        });

        return response()->json([
            ...$breakdown->toArray(),
            'yield_percent' => round($yieldGrams / $carcassGrams * 100, 1),
            'loss_kg' => round(($carcassGrams - $yieldGrams) / ButcheryCatalog::GRAMS_PER_KG, 3),
        ], 201);
    }
}
