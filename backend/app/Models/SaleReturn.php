<?php

namespace App\Models;

use App\Models\Concerns\BelongsToBusiness;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SaleReturn extends Model
{
    use BelongsToBusiness;

    protected $fillable = [
        'business_id', 'sale_id', 'return_number', 'total_refund', 'refund_payment_method_id', 'reason', 'created_by',
    ];

    protected function casts(): array
    {
        return ['total_refund' => 'decimal:2'];
    }

    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }

    public function refundPaymentMethod(): BelongsTo
    {
        return $this->belongsTo(PaymentMethod::class, 'refund_payment_method_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(SaleReturnItem::class);
    }
}
