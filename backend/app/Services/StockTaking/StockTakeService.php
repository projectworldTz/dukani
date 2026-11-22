<?php

namespace App\Services\StockTaking;

use App\Models\Inventory;
use App\Models\Product;
use App\Models\StockTake;
use App\Models\StockTakeItem;
use App\Models\User;
use App\Services\Inventory\StockMovementService;
use App\Services\Pharmacy\PharmacyStockService;
use App\Support\Tenancy\BusinessContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Physical stock-taking (spec §18): a count sheet snapshots each product's system
 * quantity at creation time (for the cashier/storekeeper doing the count to compare
 * against), counts are recorded per item, and only on approval are variances actually
 * posted as stock_movements — via StockMovementService::correctTo(), which computes
 * the real delta against CURRENT stock at approval time, not the stale snapshot (see
 * that method's docblock for why that distinction matters).
 */
class StockTakeService
{
    public function __construct(
        private StockMovementService $stockMovementService,
        private PharmacyStockService $pharmacyStockService,
    ) {}

    /** @param  int[]  $productIds */
    public function create(int $branchId, array $productIds, User $user): StockTake
    {
        return DB::transaction(function () use ($branchId, $productIds, $user) {
            $stockTake = StockTake::create([
                'business_id' => BusinessContext::id(),
                'branch_id' => $branchId,
                'status' => 'draft',
                'created_by' => $user->id,
            ]);

            $quantities = Inventory::where('branch_id', $branchId)
                ->whereIn('product_id', $productIds)
                ->pluck('quantity', 'product_id');

            foreach ($productIds as $productId) {
                StockTakeItem::create([
                    'business_id' => BusinessContext::id(),
                    'stock_take_id' => $stockTake->id,
                    'product_id' => $productId,
                    'system_quantity' => $quantities[$productId] ?? 0,
                ]);
            }

            return $stockTake->load('items.product:id,name,sku');
        });
    }

    /** @param  array<int,array{item_id:int,counted_quantity:int}>  $counts */
    public function recordCounts(StockTake $stockTake, array $counts): StockTake
    {
        $this->assertStatus($stockTake, 'draft');

        foreach ($counts as $count) {
            StockTakeItem::where('stock_take_id', $stockTake->id)
                ->findOrFail($count['item_id'])
                ->update(['counted_quantity' => $count['counted_quantity']]);
        }

        return $stockTake->fresh('items.product:id,name,sku');
    }

    public function submit(StockTake $stockTake): StockTake
    {
        $this->assertStatus($stockTake, 'draft');

        if ($stockTake->items()->whereNull('counted_quantity')->exists()) {
            throw ValidationException::withMessages(['items' => 'Every line must have a counted quantity before submitting.']);
        }

        $stockTake->update(['status' => 'submitted']);

        return $stockTake;
    }

    public function approve(StockTake $stockTake, User $approver): StockTake
    {
        $this->assertStatus($stockTake, 'submitted');

        return DB::transaction(function () use ($stockTake, $approver) {
            foreach ($stockTake->items as $item) {
                if ($item->variance() === 0) {
                    continue;
                }

                $product = Product::findOrFail($item->product_id);
                $isPharmacy = $approver->business->isPharmacy();
                $current = (int) (Inventory::where('product_id', $product->id)->where('branch_id', $stockTake->branch_id)->value('quantity') ?? 0);
                $diff = (int) $item->counted_quantity - $current;

                // Pharmacy: a shortfall comes out of the batches (expired first — they are
                // the units that should have left already); extra units stay untracked.
                if ($isPharmacy && $product->has_batch && $diff < 0) {
                    $this->pharmacyStockService->takeFromBatches($product->id, $stockTake->branch_id, -$diff, null, preferExpired: true);
                }

                $this->stockMovementService->correctTo(
                    product: $product,
                    branchId: $stockTake->branch_id,
                    targetQuantity: $item->counted_quantity,
                    type: 'adjustment',
                    reason: "Stock take #{$stockTake->id} variance",
                    reference: $stockTake,
                    userId: $approver->id,
                );

                if ($isPharmacy && $product->is_controlled && $diff !== 0) {
                    $this->pharmacyStockService->register(
                        $product, $stockTake->branch_id, 'adjusted', in: max(0, $diff), out: max(0, -$diff),
                        reference: "Stock take #{$stockTake->id}", userId: $approver->id,
                    );
                }
            }

            $stockTake->update(['status' => 'approved', 'approved_by' => $approver->id, 'approved_at' => now()]);

            return $stockTake->fresh('items.product:id,name,sku');
        });
    }

    private function assertStatus(StockTake $stockTake, string $expected): void
    {
        if ($stockTake->status !== $expected) {
            throw ValidationException::withMessages([
                'status' => "This stock take must be '{$expected}' for this action (currently '{$stockTake->status}').",
            ]);
        }
    }
}
