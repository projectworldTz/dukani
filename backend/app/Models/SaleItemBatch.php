<?php

namespace App\Models;

use App\Models\Concerns\BelongsToBusiness;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** How many units of a sold item came out of which batch (FEFO allocation). */
class SaleItemBatch extends Model
{
    use BelongsToBusiness;

    protected $fillable = [
        'business_id', 'sale_item_id', 'product_batch_id', 'batch_number', 'expiry_date', 'quantity', 'quantity_returned',
    ];

    protected function casts(): array
    {
        return ['expiry_date' => 'date', 'quantity' => 'integer', 'quantity_returned' => 'integer'];
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(ProductBatch::class, 'product_batch_id');
    }
}
