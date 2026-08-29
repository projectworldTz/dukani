<?php

namespace App\Services\Purchasing;

use App\Models\Product;
use App\Models\Purchase;
use App\Models\PurchaseItem;
use App\Models\PurchaseReturn;
use App\Models\User;
use App\Services\Inventory\StockMovementService;
use App\Services\Shared\DocumentNumberService;
use App\Support\Tenancy\BusinessContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PurchaseReturnService
{
    public function __construct(
        private DocumentNumberService $numberService,
        private StockMovementService $stockMovementService,
    ) {}

    /** @param  array<int,array{purchase_item_id:int,quantity:int}>  $lines */
    public function create(Purchase $purchase, array $lines, ?string $reason, User $user): PurchaseReturn
    {
        return DB::transaction(function () use ($purchase, $lines, $reason, $user) {
            $total = 0;
            $return = PurchaseReturn::create([
                'business_id' => BusinessContext::id(),
                'purchase_id' => $purchase->id,
                'return_number' => 'PRET-'.$this->numberService->next('', 'purchase_returns'),
                'reason' => $reason,
                'created_by' => $user->id,
            ]);

            foreach ($lines as $line) {
                /** @var PurchaseItem $item */
                $item = PurchaseItem::where('purchase_id', $purchase->id)->findOrFail($line['purchase_item_id']);
                $quantity = (int) $line['quantity'];

                if ($quantity <= 0 || $quantity > $item->quantity_received) {
                    throw ValidationException::withMessages([
                        'quantity' => "Cannot return more than the {$item->quantity_received} units received on this line.",
                    ]);
                }

                $lineTotal = $quantity * (float) $item->unit_cost;
                $total += $lineTotal;

                $return->items()->create([
                    'business_id' => BusinessContext::id(),
                    'purchase_item_id' => $item->id,
                    'product_id' => $item->product_id,
                    'quantity' => $quantity,
                    'unit_cost' => $item->unit_cost,
                    'line_total' => $lineTotal,
                ]);

                $this->stockMovementService->adjust(
                    product: Product::findOrFail($item->product_id),
                    branchId: $purchase->branch_id,
                    quantityChange: -$quantity,
                    type: 'purchase_return',
                    reason: $reason,
                    reference: $return,
                    userId: $user->id,
                );
            }

            $return->update(['total' => $total]);

            return $return->load('items');
        });
    }
}
