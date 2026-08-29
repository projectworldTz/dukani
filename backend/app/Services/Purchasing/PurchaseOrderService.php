<?php

namespace App\Services\Purchasing;

use App\Models\Purchase;
use App\Models\PurchaseItem;
use App\Models\PurchaseOrder;
use App\Models\User;
use App\Services\Shared\DocumentNumberService;
use App\Support\Tenancy\BusinessContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PurchaseOrderService
{
    public function __construct(private DocumentNumberService $numberService) {}

    public function create(array $data, User $user): PurchaseOrder
    {
        return DB::transaction(function () use ($data, $user) {
            $order = PurchaseOrder::create([
                'business_id' => BusinessContext::id(),
                'branch_id' => $data['branch_id'],
                'supplier_id' => $data['supplier_id'],
                'order_number' => 'PO-'.$this->numberService->next('', 'purchase_orders'),
                'status' => 'draft',
                'notes' => $data['notes'] ?? null,
                'created_by' => $user->id,
            ]);

            foreach ($data['items'] as $item) {
                $order->items()->create([
                    'business_id' => BusinessContext::id(),
                    'product_id' => $item['product_id'],
                    'quantity_ordered' => $item['quantity_ordered'],
                    'unit_cost' => $item['unit_cost'],
                ]);
            }

            return $order->load('items');
        });
    }

    public function updateStatus(PurchaseOrder $order, string $status): PurchaseOrder
    {
        if ($order->status === 'converted') {
            throw ValidationException::withMessages(['status' => 'This purchase order has already been converted to a purchase.']);
        }

        $order->update(['status' => $status]);

        return $order;
    }

    /** Converts an approved PO into a Purchase (goods-received/invoice record) ready to receive stock against. */
    public function convertToPurchase(PurchaseOrder $order, User $user): Purchase
    {
        if ($order->status !== 'approved') {
            throw ValidationException::withMessages(['status' => 'Only an approved purchase order can be converted.']);
        }

        return DB::transaction(function () use ($order, $user) {
            $order->load('items');
            $subtotal = $order->items->sum(fn ($item) => $item->unit_cost * $item->quantity_ordered);

            $purchase = Purchase::create([
                'business_id' => BusinessContext::id(),
                'branch_id' => $order->branch_id,
                'supplier_id' => $order->supplier_id,
                'purchase_order_id' => $order->id,
                'purchase_number' => 'PUR-'.$this->numberService->next('', 'purchases'),
                'status' => 'pending',
                'subtotal' => $subtotal,
                'tax_total' => 0,
                'grand_total' => $subtotal,
            ]);

            foreach ($order->items as $item) {
                PurchaseItem::create([
                    'business_id' => BusinessContext::id(),
                    'purchase_id' => $purchase->id,
                    'product_id' => $item->product_id,
                    'quantity_ordered' => $item->quantity_ordered,
                    'quantity_received' => 0,
                    'unit_cost' => $item->unit_cost,
                    'tax_amount' => 0,
                    'line_total' => $item->unit_cost * $item->quantity_ordered,
                ]);
            }

            $order->update(['status' => 'converted']);

            return $purchase->load('items');
        });
    }
}
