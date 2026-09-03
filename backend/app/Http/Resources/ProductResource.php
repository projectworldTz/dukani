<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'name' => $this->name,
            'description' => $this->description,
            'sku' => $this->sku,
            'image_url' => $this->image_path ? asset('storage/'.$this->image_path) : null,
            'category' => $this->whenLoaded('category', fn () => $this->category?->only(['id', 'name'])),
            'brand' => $this->whenLoaded('brand', fn () => $this->brand?->only(['id', 'name'])),
            'unit' => $this->whenLoaded('unit', fn () => $this->unit?->only(['id', 'name', 'short_name'])),
            'cost_price' => $this->cost_price,
            'selling_price' => $this->selling_price,
            'wholesale_price' => $this->wholesale_price,
            'minimum_selling_price' => $this->minimum_selling_price,
            'tax_rate' => $this->tax_rate,
            'is_tax_inclusive' => $this->is_tax_inclusive,
            'discount_percent' => $this->discount_percent,
            'reorder_level' => $this->reorder_level,
            'max_stock_level' => $this->max_stock_level,
            'shelf_location' => $this->shelf_location,
            'has_expiry' => $this->has_expiry,
            'has_batch' => $this->has_batch,
            'has_serial' => $this->has_serial,
            'status' => $this->status,
            'available_stock' => $this->when(
                array_key_exists('available_stock', $this->resource->getAttributes()),
                fn () => (int) ($this->available_stock ?? 0),
            ),
            'barcodes' => $this->whenLoaded('barcodes', fn () => $this->barcodes->map(fn ($b) => [
                'code' => $b->code, 'type' => $b->type, 'is_primary' => $b->is_primary,
            ])),
            'created_at' => $this->created_at,
        ];
    }
}
