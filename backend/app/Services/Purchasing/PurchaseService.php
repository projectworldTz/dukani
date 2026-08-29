<?php

namespace App\Services\Purchasing;

use App\Models\Product;
use App\Models\ProductBatch;
use App\Models\Purchase;
use App\Models\PurchaseItem;
use App\Models\SupplierPayment;
use App\Models\User;
use App\Services\Inventory\StockMovementService;
use App\Services\Shared\DocumentNumberService;
use App\Support\Tenancy\BusinessContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PurchaseService
{
    public function __construct(
        private DocumentNumberService $numberService,
        private StockMovementService $stockMovementService,
    ) {}

    public function create(array $data, User $user): Purchase
    {
        return DB::transaction(function () use ($data) {
            $items = $data['items'];
            $subtotal = array_sum(array_map(fn ($i) => $i['unit_cost'] * $i['quantity_ordered'], $items));
            $taxTotal = array_sum(array_map(fn ($i) => $i['tax_amount'] ?? 0, $items));

            $purchase = Purchase::create([
                'business_id' => BusinessContext::id(),
                'branch_id' => $data['branch_id'],
                'supplier_id' => $data['supplier_id'],
                'purchase_number' => 'PUR-'.$this->numberService->next('', 'purchases'),
                'status' => 'pending',
                'subtotal' => $subtotal,
                'tax_total' => $taxTotal,
                'grand_total' => $subtotal + $taxTotal,
                'notes' => $data['notes'] ?? null,
            ]);

            foreach ($items as $item) {
                PurchaseItem::create([
                    'business_id' => BusinessContext::id(),
                    'purchase_id' => $purchase->id,
                    'product_id' => $item['product_id'],
                    'quantity_ordered' => $item['quantity_ordered'],
                    'quantity_received' => 0,
                    'unit_cost' => $item['unit_cost'],
                    'tax_amount' => $item['tax_amount'] ?? 0,
                    'line_total' => $item['unit_cost'] * $item['quantity_ordered'] + ($item['tax_amount'] ?? 0),
                ]);
            }

            return $purchase->load('items');
        });
    }

    /**
     * Receives some or all of the outstanding quantity on each line (spec §21: partial
     * or full delivery). Only the newly-received delta moves stock — calling this
     * again later for the remaining quantity doesn't double-count what a previous
     * partial receipt already posted. Product cost_price is updated to the latest
     * purchase cost (standard "last cost" costing), and a product_batches row is
     * created when the product tracks batches/expiry.
     *
     * @param  array<int,array{purchase_item_id:int,quantity:int,batch_number?:string,expiry_date?:string}>  $receipts
     */
    public function receive(Purchase $purchase, array $receipts, User $user): Purchase
    {
        if ($purchase->status === 'cancelled') {
            throw ValidationException::withMessages(['status' => 'This purchase has been cancelled.']);
        }

        return DB::transaction(function () use ($purchase, $receipts, $user) {
            foreach ($receipts as $receipt) {
                /** @var PurchaseItem $item */
                $item = PurchaseItem::where('purchase_id', $purchase->id)->findOrFail($receipt['purchase_item_id']);
                $quantity = (int) $receipt['quantity'];

                if ($quantity <= 0) {
                    continue;
                }

                if ($quantity > $item->outstandingQuantity()) {
                    throw ValidationException::withMessages([
                        'quantity' => "Cannot receive {$quantity} — only {$item->outstandingQuantity()} outstanding on this line.",
                    ]);
                }

                $product = Product::findOrFail($item->product_id);

                $this->stockMovementService->adjust(
                    product: $product,
                    branchId: $purchase->branch_id,
                    quantityChange: $quantity,
                    type: 'purchase',
                    reference: $purchase,
                    userId: $user->id,
                );

                $product->update(['cost_price' => $item->unit_cost]);

                $item->update(['quantity_received' => $item->quantity_received + $quantity]);

                if (($product->has_batch || $product->has_expiry) && ! empty($receipt['batch_number'])) {
                    $batch = ProductBatch::firstOrNew([
                        'business_id' => BusinessContext::id(),
                        'product_id' => $product->id,
                        'branch_id' => $purchase->branch_id,
                        'batch_number' => $receipt['batch_number'],
                    ]);
                    $batch->fill([
                        'expiry_date' => $receipt['expiry_date'] ?? $batch->expiry_date,
                        'purchase_item_id' => $item->id,
                        'quantity_received' => ($batch->quantity_received ?? 0) + $quantity,
                        'quantity_remaining' => ($batch->quantity_remaining ?? 0) + $quantity,
                    ])->save();
                }
            }

            $purchase->load('items');
            $fullyReceived = $purchase->items->every(fn (PurchaseItem $i) => $i->outstandingQuantity() <= 0);
            $anyReceived = $purchase->items->sum('quantity_received') > 0;

            $purchase->update([
                'status' => $fullyReceived ? 'received' : ($anyReceived ? 'partially_received' : 'pending'),
                'received_by' => $user->id,
                'received_at' => $fullyReceived ? now() : $purchase->received_at,
            ]);

            return $purchase->fresh('items');
        });
    }

    public function recordPayment(Purchase $purchase, float $amount, ?int $paymentMethodId, ?string $reference, User $user): SupplierPayment
    {
        if ($amount <= 0) {
            throw ValidationException::withMessages(['amount' => 'Payment amount must be greater than zero.']);
        }

        return DB::transaction(function () use ($purchase, $amount, $paymentMethodId, $reference, $user) {
            $payment = SupplierPayment::create([
                'business_id' => BusinessContext::id(),
                'supplier_id' => $purchase->supplier_id,
                'purchase_id' => $purchase->id,
                'amount' => $amount,
                'payment_method_id' => $paymentMethodId,
                'reference' => $reference,
                'paid_by' => $user->id,
            ]);

            $purchase->increment('amount_paid', $amount);

            return $payment;
        });
    }
}
