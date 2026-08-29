<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SaleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'receipt_number' => $this->receipt_number,
            'status' => $this->status,
            'branch_id' => $this->branch_id,
            'cashier' => $this->whenLoaded('cashier', fn () => $this->cashier->only(['id', 'name'])),
            'customer_id' => $this->customer_id,
            'customer_name' => $this->customer_name,
            'customer_phone' => $this->customer_phone,
            'subtotal' => $this->subtotal,
            'discount_total' => $this->discount_total,
            'tax_total' => $this->tax_total,
            'grand_total' => $this->grand_total,
            'amount_paid' => $this->amount_paid,
            'change_amount' => $this->change_amount,
            'outstanding_balance' => max(0, (float) $this->grand_total - (float) $this->amount_paid),
            'loyalty_points_earned' => $this->loyalty_points_earned,
            'loyalty_points_redeemed' => $this->loyalty_points_redeemed,
            'currency' => $this->currency,
            'notes' => $this->notes,
            'items' => $this->whenLoaded('items', fn () => $this->items->map(fn ($item) => [
                'product_id' => $item->product_id,
                'product_name' => $item->product_name,
                'sku' => $item->sku,
                'quantity' => $item->quantity,
                'unit_price' => $item->unit_price,
                'discount_amount' => $item->discount_amount,
                'tax_amount' => $item->tax_amount,
                'line_total' => $item->line_total,
            ])),
            'payments' => $this->whenLoaded('payments', fn () => $this->payments->map(fn ($p) => [
                'payment_method' => $p->paymentMethod?->name,
                'amount' => $p->amount,
                'reference' => $p->reference,
            ])),
            'completed_at' => $this->completed_at,
            'created_at' => $this->created_at,
        ];
    }
}
