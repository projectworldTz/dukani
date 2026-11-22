<?php

namespace App\Services\Sales;

use App\Models\Product;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\SaleReturn;
use App\Models\SaleReturnItem;
use App\Models\User;
use App\Services\Inventory\StockMovementService;
use App\Services\Pharmacy\PharmacyStockService;
use App\Services\Shared\DocumentNumberService;
use App\Support\Tenancy\BusinessContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Spec §25: a return always references the original sale. Sellable-condition items go
 * back into inventory (stock_movements type=sale_return); damaged items don't — they
 * physically came back to the shop but were never fit to resell, so the sellable count
 * never changes for that line (no movement row for it). Reduces the sale's own
 * grand_total by the value of what's returned and refunds cash up to what was actually
 * paid, which also transparently reduces a credit customer's outstanding balance.
 */
class SaleReturnService
{
    public function __construct(
        private DocumentNumberService $numberService,
        private StockMovementService $stockMovementService,
        private PharmacyStockService $pharmacyStockService,
    ) {}

    /** @param  array<int,array{sale_item_id:int,quantity:int,condition:string}>  $lines */
    public function create(Sale $sale, array $lines, ?int $refundPaymentMethodId, ?string $reason, User $user): SaleReturn
    {
        if (! in_array($sale->status, ['completed', 'partially_refunded'], true)) {
            throw ValidationException::withMessages(['sale' => 'Only a completed sale can be returned.']);
        }

        return DB::transaction(function () use ($sale, $lines, $refundPaymentMethodId, $reason, $user) {
            $return = SaleReturn::create([
                'business_id' => BusinessContext::id(),
                'sale_id' => $sale->id,
                'return_number' => 'SRET-'.$this->numberService->next('', 'sale_returns'),
                'refund_payment_method_id' => $refundPaymentMethodId,
                'reason' => $reason,
                'created_by' => $user->id,
            ]);

            $totalValue = 0;

            foreach ($lines as $line) {
                /** @var SaleItem $saleItem */
                $saleItem = SaleItem::where('sale_id', $sale->id)->findOrFail($line['sale_item_id']);
                $quantity = (int) $line['quantity'];
                $condition = $line['condition'] ?? 'sellable';

                $alreadyReturned = SaleReturnItem::where('sale_item_id', $saleItem->id)->sum('quantity');
                if ($quantity <= 0 || $quantity > ($saleItem->quantity - $alreadyReturned)) {
                    throw ValidationException::withMessages([
                        'quantity' => "Cannot return more than the ".($saleItem->quantity - $alreadyReturned)." unit(s) still eligible on \"{$saleItem->product_name}\".",
                    ]);
                }

                // Prorate off the item's net line_total (already discount- and tax-adjusted),
                // not the gross unit_price — otherwise a discounted or taxed line refunds
                // the wrong amount and over/under-adjusts the sale's remaining balance.
                $netUnitPrice = $saleItem->quantity > 0
                    ? (float) $saleItem->line_total / $saleItem->quantity
                    : (float) $saleItem->unit_price;
                $lineTotal = round($quantity * $netUnitPrice, 2);
                $totalValue += $lineTotal;

                $return->items()->create([
                    'business_id' => BusinessContext::id(),
                    'sale_item_id' => $saleItem->id,
                    'product_id' => $saleItem->product_id,
                    'quantity' => $quantity,
                    'unit_price' => $saleItem->unit_price,
                    'line_total' => $lineTotal,
                    'condition' => $condition,
                ]);

                $returnedProduct = $saleItem->product_id ? Product::find($saleItem->product_id) : null;
                if ($condition === 'sellable' && $returnedProduct && $returnedProduct->has_batch && $user->business->isPharmacy()) {
                    // Back into the same batches it was dispensed from.
                    $this->pharmacyStockService->restoreReturn($saleItem, $returnedProduct, $quantity, $sale, $return, $reason, $user->id);
                } elseif ($condition === 'sellable' && $saleItem->product_id) {
                    $this->stockMovementService->adjust(
                        product: Product::findOrFail($saleItem->product_id),
                        branchId: $sale->branch_id,
                        quantityChange: $quantity,
                        type: 'sale_return',
                        reason: $reason,
                        reference: $return,
                        userId: $user->id,
                    );
                }
            }

            $refundAmount = min($totalValue, (float) $sale->amount_paid);
            $return->update(['total_refund' => $refundAmount]);

            $newGrandTotal = max(0, (float) $sale->grand_total - $totalValue);
            $fullyReturned = SaleItem::where('sale_id', $sale->id)->get()->every(
                fn (SaleItem $item) => SaleReturnItem::where('sale_item_id', $item->id)->sum('quantity') >= $item->quantity
            );

            $sale->update([
                'grand_total' => $newGrandTotal,
                'amount_paid' => max(0, (float) $sale->amount_paid - $refundAmount),
                'status' => $fullyReturned ? 'refunded' : 'partially_refunded',
            ]);

            return $return->load('items');
        });
    }
}
