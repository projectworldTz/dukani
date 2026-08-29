<?php

namespace App\Http\Controllers\Api\V1\Products;

use App\Http\Controllers\Controller;
use App\Models\ProductBatch;
use Illuminate\Http\Request;

/** Expiry alerts per spec §19: expiring within 90/30/7 days, or already expired. */
class ProductBatchController extends Controller
{
    public function index(Request $request)
    {
        abort_unless($request->user()->can('inventory.view'), 403);

        $withinDays = $request->integer('within_days', 90);

        return ProductBatch::with('product:id,name,sku', 'branch:id,name')
            ->where('quantity_remaining', '>', 0)
            ->whereNotNull('expiry_date')
            ->when($request->filled('branch_id'), fn ($q) => $q->where('branch_id', $request->integer('branch_id')))
            ->when(
                $request->boolean('expired_only'),
                fn ($q) => $q->where('expiry_date', '<', now()->toDateString()),
                fn ($q) => $q->where('expiry_date', '<=', now()->addDays($withinDays)->toDateString()),
            )
            ->orderBy('expiry_date')
            ->get()
            ->map(fn (ProductBatch $batch) => [
                ...$batch->toArray(),
                'is_expired' => $batch->expiry_date->isPast(),
                'days_until_expiry' => now()->startOfDay()->diffInDays($batch->expiry_date, false),
            ]);
    }
}
