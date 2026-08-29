<?php

namespace App\Models;

use App\Models\Concerns\BelongsToBusiness;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Inventory extends Model
{
    use BelongsToBusiness;

    protected $fillable = ['business_id', 'product_id', 'branch_id', 'quantity', 'reorder_level'];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function effectiveReorderLevel(): int
    {
        return $this->reorder_level ?? $this->product->reorder_level;
    }
}
