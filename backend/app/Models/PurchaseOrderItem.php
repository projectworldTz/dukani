<?php

namespace App\Models;

use App\Models\Concerns\BelongsToBusiness;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PurchaseOrderItem extends Model
{
    use BelongsToBusiness;

    protected $fillable = ['business_id', 'purchase_order_id', 'product_id', 'quantity_ordered', 'unit_cost'];

    protected function casts(): array
    {
        return ['unit_cost' => 'decimal:2'];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
