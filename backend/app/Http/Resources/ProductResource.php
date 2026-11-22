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
            'generic_name' => $this->generic_name,
            'strength' => $this->strength,
            'dosage_form' => $this->dosage_form,
            'pack_size' => $this->pack_size,
            'manufacturer' => $this->manufacturer,
            'requires_prescription' => (bool) $this->requires_prescription,
            'is_controlled' => (bool) $this->is_controlled,
            'sold_by_weight' => (bool) $this->sold_by_weight,
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
            'expired_stock' => $this->when(
                array_key_exists('expired_stock', $this->resource->getAttributes()),
                fn () => (int) ($this->expired_stock ?? 0),
            ),
            'nearest_expiry' => $this->when(
                array_key_exists('nearest_expiry', $this->resource->getAttributes()),
                fn () => $this->nearest_expiry ? substr((string) $this->nearest_expiry, 0, 10) : null,
            ),
            'barcodes' => $this->whenLoaded('barcodes', fn () => $this->barcodes->map(fn ($b) => [
                'code' => $b->code, 'type' => $b->type, 'is_primary' => $b->is_primary,
            ])),
            'created_at' => $this->created_at,
        ];
    }
}
