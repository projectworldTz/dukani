<?php

namespace App\Models;

use App\Models\Concerns\BelongsToBusiness;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductBatch extends Model
{
    use BelongsToBusiness;

    protected $fillable = [
        'business_id', 'product_id', 'branch_id', 'batch_number', 'manufactured_at',
        'expiry_date', 'quantity_received', 'quantity_remaining', 'purchase_item_id',
    ];

    protected function casts(): array
    {
        return [
            'manufactured_at' => 'date',
            'expiry_date' => 'date',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }
}
