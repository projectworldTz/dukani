<?php

namespace App\Http\Controllers\Api\V1\Pharmacy;

use App\Http\Controllers\Controller;
use App\Models\ControlledDrugEntry;
use App\Models\Prescription;
use App\Models\Product;
use App\Models\ProductBatch;
use App\Support\Pharmacy\PharmacyCatalog;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/**
 * Read-only pharmacy screens: expiry overview, prescriptions book, controlled drugs
 * register and per-medicine batches. Writes all happen through the normal product,
 * stock and sale endpoints, which are batch-aware for pharmacies.
 */
class PharmacyController extends Controller
{
    private function guard(Request $request): void
    {
        abort_unless($request->user()->business?->isPharmacy(), 404, 'This is only available on the pharmacy platform.');
    }

    private function today(Request $request): Carbon
    {
        return Carbon::now($request->user()->business->timezone ?: config('app.timezone'))->startOfDay();
    }

    /** Dosage forms and other fixed lists for the medicine form. */
    public function catalog(Request $request)
    {
        $this->guard($request);

        return ['dosage_forms' => PharmacyCatalog::DOSAGE_FORMS];
    }

    public function summary(Request $request)
    {
        $this->guard($request);
        abort_unless($request->user()->can('inventory.view') || $request->user()->can('sales.view.all'), 403);

        $today = $this->today($request)->toDateString();
        $branchId = $request->integer('branch_id') ?: null;
        $batches = fn () => ProductBatch::where('quantity_remaining', '>', 0)->whereNotNull('expiry_date')
            ->when($branchId, fn ($q) => $q->where('branch_id', $branchId));

        $expiring = fn (int $days) => $batches()->whereBetween('expiry_date', [$today, $this->today($request)->addDays($days)->toDateString()]);
        $tz = $request->user()->business->timezone ?: config('app.timezone');
        $startOfDayUtc = Carbon::now($tz)->startOfDay()->utc();

        return [
            'expired_batches' => $batches()->where('expiry_date', '<', $today)->count(),
            'expired_units' => (int) $batches()->where('expiry_date', '<', $today)->sum('quantity_remaining'),
            'expiring_30_batches' => $expiring(30)->count(),
            'expiring_90_batches' => $expiring(90)->count(),
            'expiring_90_units' => (int) $expiring(90)->sum('quantity_remaining'),
            'prescriptions_today' => Prescription::where('created_at', '>=', $startOfDayUtc)->count(),
            'controlled_medicines' => Product::where('is_controlled', true)->count(),
            'prescription_medicines' => Product::where('requires_prescription', true)->count(),
        ];
    }

    /** Batches of one medicine at a branch, nearest expiry first. */
    public function productBatches(Request $request, Product $product)
    {
        $this->guard($request);
        abort_unless($request->user()->can('inventory.view') || $request->user()->can('products.manage'), 403);

        $today = $this->today($request);

        return ProductBatch::where('product_id', $product->id)
            ->when($request->filled('branch_id'), fn ($q) => $q->where('branch_id', $request->integer('branch_id')))
            ->where('quantity_remaining', '>', 0)
            ->orderByRaw('expiry_date IS NULL')->orderBy('expiry_date')
            ->get()
            ->map(fn (ProductBatch $b) => [
                'id' => $b->id,
                'batch_number' => $b->batch_number,
                'expiry_date' => $b->expiry_date?->toDateString(),
                'manufactured_at' => $b->manufactured_at?->toDateString(),
                'quantity_received' => $b->quantity_received,
                'quantity_remaining' => $b->quantity_remaining,
                'days_until_expiry' => $b->expiry_date ? (int) $today->diffInDays($b->expiry_date, false) : null,
                'is_expired' => $b->expiry_date !== null && $b->expiry_date->lt($today),
            ]);
    }

    /** Expiring and expired batches across all medicines (Stock & Expiry screen). */
    public function expiry(Request $request)
    {
        $this->guard($request);
        abort_unless($request->user()->can('inventory.view'), 403);

        $today = $this->today($request);
        $status = $request->input('status', 'expiring');
        $within = min(max($request->integer('within_days', 90), 1), 730);

        return ProductBatch::with('product:id,name,generic_name,strength,dosage_form,cost_price,is_controlled', 'branch:id,name')
            ->where('quantity_remaining', '>', 0)->whereNotNull('expiry_date')
            ->when($request->filled('branch_id'), fn ($q) => $q->where('branch_id', $request->integer('branch_id')))
            ->when($status === 'expired',
                fn ($q) => $q->where('expiry_date', '<', $today->toDateString()),
                fn ($q) => $q->whereBetween('expiry_date', [$today->toDateString(), $today->copy()->addDays($within)->toDateString()]))
            ->orderBy('expiry_date')
            ->get()
            ->map(fn (ProductBatch $b) => [
                'id' => $b->id,
                'product' => $b->product,
                'branch' => $b->branch,
                'batch_number' => $b->batch_number,
                'expiry_date' => $b->expiry_date->toDateString(),
                'quantity_remaining' => $b->quantity_remaining,
                'value_at_cost' => round($b->quantity_remaining * (float) ($b->product?->cost_price ?? 0), 2),
                'days_until_expiry' => (int) $today->diffInDays($b->expiry_date, false),
                'is_expired' => $b->expiry_date->lt($today),
            ]);
    }

    public function prescriptions(Request $request)
    {
        $this->guard($request);
        $user = $request->user();
        $canAll = $user->can('sales.view.all');
        abort_unless($canAll || $user->can('sales.view.own'), 403);

        return Prescription::with(['sale:id,receipt_number,grand_total,completed_at,status,cashier_id', 'sale.items:id,sale_id,product_name,quantity,dosage_instructions', 'recorder:id,name'])
            ->when(! $canAll, fn ($q) => $q->whereHas('sale', fn ($s) => $s->where('cashier_id', $user->id)))
            ->when($request->filled('search'), function ($q) use ($request) {
                $term = '%'.$request->string('search').'%';
                $q->where(fn ($w) => $w->where('patient_name', 'like', $term)->orWhere('rx_number', 'like', $term)->orWhere('prescriber_name', 'like', $term));
            })
            ->orderByDesc('created_at')
            ->paginate(min(max($request->integer('per_page', 20), 1), 100));
    }

    public function controlledRegister(Request $request)
    {
        $this->guard($request);
        abort_unless($request->user()->can('inventory.view'), 403);

        return ControlledDrugEntry::with(['product:id,name,generic_name,strength,dosage_form', 'batch:id,batch_number,expiry_date', 'recorder:id,name', 'sale:id,receipt_number', 'branch:id,name'])
            ->when($request->filled('product_id'), fn ($q) => $q->where('product_id', $request->integer('product_id')))
            ->when($request->filled('branch_id'), fn ($q) => $q->where('branch_id', $request->integer('branch_id')))
            ->orderByDesc('created_at')->orderByDesc('id')
            ->paginate(min(max($request->integer('per_page', 25), 1), 100));
    }
}
