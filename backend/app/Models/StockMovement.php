<?php

namespace App\Models;

use App\Models\Concerns\BelongsToBusiness;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Append-only — rows are only ever inserted, via
 * App\Services\Inventory\StockMovementService. No controller should update/delete these.
 */
class StockMovement extends Model
{
    use BelongsToBusiness;

    protected $fillable = [
        'business_id', 'product_id', 'branch_id',
        'previous_quantity', 'quantity_change', 'new_quantity',
        'type', 'reference_type', 'reference_id', 'reason', 'user_id',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
