<?php

namespace App\Services\Inventory;

use App\Models\BusinessNotification;
use App\Models\Inventory;
use App\Models\Product;
use App\Models\StockMovement;
use App\Support\Tenancy\BusinessContext;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * The single choke point every stock-affecting action must go through — every call
 * here both changes `inventories.quantity` and appends one `stock_movements` row in
 * the same DB transaction, so stock and its audit trail can never drift apart (spec
 * §15/§16: "never allow unexplained stock changes").
 *
 * Locks the inventory row with lockForUpdate() before reading its quantity, so two
 * concurrent calls for the same product+branch (e.g. two cashiers selling the last
 * unit at once) serialize instead of racing — the second call sees the first call's
 * committed quantity, not a stale one (spec §45).
 */
class StockMovementService
{
    public function adjust(
        Product $product,
        int $branchId,
        int $quantityChange,
        string $type,
        ?string $reason = null,
        mixed $reference = null,
        ?int $userId = null,
        bool $allowNegative = false,
    ): StockMovement {
        return DB::transaction(function () use ($product, $branchId, $quantityChange, $type, $reason, $reference, $userId, $allowNegative) {
            $inventory = $this->lockInventoryRow($product->id, $branchId);
            $newQuantity = $inventory->quantity + $quantityChange;

            if (! $allowNegative && $newQuantity < 0) {
                throw ValidationException::withMessages([
                    'quantity' => "Insufficient stock for \"{$product->name}\" (have {$inventory->quantity}, need ".abs($quantityChange).').',
                ]);
            }

            return $this->applyAndLog($inventory, $newQuantity, $type, $reason, $reference, $userId);
        });
    }

    /**
     * Corrects stock to an absolute target quantity rather than a relative delta —
     * used by stock-taking approval (spec §18), where the physical count is the true
     * value regardless of what `inventories.quantity` currently reads. Computing the
     * delta from the row locked *here* (not from a `system_quantity` snapshotted
     * earlier) means any sales/purchases that happened between the count and the
     * approval are respected rather than clobbered.
     */
    public function correctTo(
        Product $product,
        int $branchId,
        int $targetQuantity,
        string $type,
        ?string $reason = null,
        mixed $reference = null,
        ?int $userId = null,
    ): StockMovement {
        return DB::transaction(function () use ($product, $branchId, $targetQuantity, $type, $reason, $reference, $userId) {
            $inventory = $this->lockInventoryRow($product->id, $branchId);

            return $this->applyAndLog($inventory, $targetQuantity, $type, $reason, $reference, $userId);
        });
    }

    private function lockInventoryRow(int $productId, int $branchId): Inventory
    {
        $inventory = Inventory::where('product_id', $productId)
            ->where('branch_id', $branchId)
            ->lockForUpdate()
            ->first();

        return $inventory ?? Inventory::create([
            'business_id' => BusinessContext::id(),
            'product_id' => $productId,
            'branch_id' => $branchId,
            'quantity' => 0,
        ]);
    }

    private function applyAndLog(
        Inventory $inventory,
        int $newQuantity,
        string $type,
        ?string $reason,
        mixed $reference,
        ?int $userId,
    ): StockMovement {
        $previousQuantity = $inventory->quantity;
        $inventory->update(['quantity' => $newQuantity]);
        $this->notifyIfCrossedLowStock($inventory, $previousQuantity, $newQuantity);

        return StockMovement::create([
            'business_id' => BusinessContext::id(),
            'product_id' => $inventory->product_id,
            'branch_id' => $inventory->branch_id,
            'previous_quantity' => $previousQuantity,
            'quantity_change' => $newQuantity - $previousQuantity,
            'new_quantity' => $newQuantity,
            'type' => $type,
            'reference_type' => $reference instanceof Model ? $reference->getMorphClass() : null,
            'reference_id' => $reference instanceof Model ? $reference->getKey() : null,
            'reason' => $reason,
            'user_id' => $userId,
        ]);
    }

    /**
     * Notifies once, at the moment stock crosses at-or-below the reorder level, not on
     * every subsequent movement while it stays low (spec §17's low-stock alert) —
     * comparing previous vs new quantity against the threshold is what limits it to
     * the crossing event.
     */
    private function notifyIfCrossedLowStock(Inventory $inventory, int $previousQuantity, int $newQuantity): void
    {
        $reorderLevel = $inventory->reorder_level ?? Product::find($inventory->product_id)?->reorder_level ?? 0;

        if ($newQuantity <= $reorderLevel && $previousQuantity > $reorderLevel) {
            $product = Product::find($inventory->product_id);
            BusinessNotification::create([
                'business_id' => BusinessContext::id(),
                'type' => $newQuantity <= 0 ? 'out_of_stock' : 'low_stock',
                'title' => $newQuantity <= 0 ? 'Out of stock' : 'Low stock',
                'message' => "\"{$product?->name}\" is at {$newQuantity} units (reorder level {$reorderLevel}).",
            ]);
        }
    }
}
