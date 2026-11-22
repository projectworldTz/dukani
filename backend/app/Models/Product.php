<?php

namespace App\Models;

use App\Models\Concerns\BelongsToBusiness;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Product extends Model
{
    use BelongsToBusiness, HasFactory, SoftDeletes;

    protected $fillable = [
        'business_id', 'uuid', 'category_id', 'brand_id', 'unit_id', 'supplier_id',
        'name', 'description', 'sku', 'image_path',
        'generic_name', 'strength', 'dosage_form', 'pack_size', 'manufacturer', 'requires_prescription', 'is_controlled', 'sold_by_weight',
        'cost_price', 'selling_price', 'wholesale_price', 'minimum_selling_price',
        'tax_rate', 'is_tax_inclusive', 'discount_percent',
        'reorder_level', 'max_stock_level', 'shelf_location',
        'has_expiry', 'has_batch', 'has_serial', 'status', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'cost_price' => 'decimal:2',
            'selling_price' => 'decimal:2',
            'wholesale_price' => 'decimal:2',
            'minimum_selling_price' => 'decimal:2',
            'tax_rate' => 'decimal:2',
            'discount_percent' => 'decimal:2',
            'is_tax_inclusive' => 'boolean',
            'has_expiry' => 'boolean',
            'has_batch' => 'boolean',
            'has_serial' => 'boolean',
            'requires_prescription' => 'boolean',
            'is_controlled' => 'boolean',
            'sold_by_weight' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Product $product) {
            $product->uuid ??= (string) Str::uuid();
        });
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(ProductCategory::class, 'category_id');
    }

    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function barcodes(): HasMany
    {
        return $this->hasMany(Barcode::class);
    }

    public function inventories(): HasMany
    {
        return $this->hasMany(Inventory::class);
    }

    public function batches(): HasMany
    {
        return $this->hasMany(ProductBatch::class);
    }
}
