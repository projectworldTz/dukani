<?php

namespace App\Models;

use App\Models\Concerns\BelongsToBusiness;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockTakeItem extends Model
{
    use BelongsToBusiness;

    protected $fillable = ['business_id', 'stock_take_id', 'product_id', 'system_quantity', 'counted_quantity'];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function variance(): ?int
    {
        return $this->counted_quantity === null ? null : $this->counted_quantity - $this->system_quantity;
    }
}
