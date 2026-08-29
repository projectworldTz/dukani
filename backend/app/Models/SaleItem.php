<?php

namespace App\Models;

use App\Models\Concerns\BelongsToBusiness;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Snapshot row — product_name/sku/unit_price/cost_price/tax/discount are copied at
 * sale time and never re-derived from the live Product, per spec §57 (a later price
 * change must never alter a historical receipt or report).
 */
class SaleItem extends Model
{
    use BelongsToBusiness;

    protected $fillable = [
        'business_id', 'sale_id', 'product_id', 'product_name', 'sku',
        'quantity', 'unit_price', 'cost_price', 'discount_amount', 'tax_amount', 'line_total',
    ];

    protected function casts(): array
    {
        return [
            'unit_price' => 'decimal:2',
            'cost_price' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'tax_amount' => 'decimal:2',
            'line_total' => 'decimal:2',
        ];
    }

    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
