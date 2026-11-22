<?php

namespace App\Models;

use App\Models\Concerns\BelongsToBusiness;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One line in the controlled drugs register, with the running balance after it. */
class ControlledDrugEntry extends Model
{
    use BelongsToBusiness;

    protected $fillable = [
        'business_id', 'branch_id', 'product_id', 'product_batch_id', 'type', 'quantity_in', 'quantity_out',
        'balance_after', 'sale_id', 'prescription_id', 'patient_name', 'prescriber_name', 'reference', 'recorded_by',
    ];

    protected function casts(): array
    {
        return ['quantity_in' => 'integer', 'quantity_out' => 'integer', 'balance_after' => 'integer'];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class)->withTrashed();
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(ProductBatch::class, 'product_batch_id');
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
