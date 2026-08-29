<?php

namespace App\Models;

use App\Models\Concerns\BelongsToBusiness;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PurchaseReturnItem extends Model
{
    use BelongsToBusiness;

    protected $fillable = [
        'business_id', 'purchase_return_id', 'purchase_item_id', 'product_id', 'quantity', 'unit_cost', 'line_total',
    ];

    protected function casts(): array
    {
        return ['unit_cost' => 'decimal:2', 'line_total' => 'decimal:2'];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function purchaseItem(): BelongsTo
    {
        return $this->belongsTo(PurchaseItem::class);
    }
}
