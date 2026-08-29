<?php

namespace App\Models;

use App\Models\Concerns\BelongsToBusiness;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PurchaseItem extends Model
{
    use BelongsToBusiness;

    protected $fillable = [
        'business_id', 'purchase_id', 'product_id', 'quantity_ordered', 'quantity_received',
        'unit_cost', 'tax_amount', 'line_total', 'batch_number', 'expiry_date',
    ];

    protected function casts(): array
    {
        return [
            'unit_cost' => 'decimal:2',
            'tax_amount' => 'decimal:2',
            'line_total' => 'decimal:2',
            'expiry_date' => 'date',
        ];
    }

    public function purchase(): BelongsTo
    {
        return $this->belongsTo(Purchase::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function outstandingQuantity(): int
    {
        return $this->quantity_ordered - $this->quantity_received;
    }
}
