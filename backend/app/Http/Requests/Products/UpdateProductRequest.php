<?php

namespace App\Http\Requests\Products;

use App\Support\Tenancy\BusinessContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('products.manage');
    }

    public function rules(): array
    {
        $businessId = BusinessContext::id();
        $productId = $this->route('product')?->id;

        return [
            'name' => ['sometimes', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string'],
            'sku' => ['sometimes', 'nullable', 'string', 'max:100', Rule::unique('products', 'sku')->where('business_id', $businessId)->ignore($productId)],
            'category_id' => ['sometimes', 'nullable', 'integer', Rule::exists('product_categories', 'id')->where('business_id', $businessId)],
            'brand_id' => ['sometimes', 'nullable', 'integer', Rule::exists('brands', 'id')->where('business_id', $businessId)],
            'unit_id' => ['sometimes', 'nullable', 'integer', Rule::exists('units', 'id')->where('business_id', $businessId)],
            'supplier_id' => ['sometimes', 'nullable', 'integer', Rule::exists('suppliers', 'id')->where('business_id', $businessId)],
            'cost_price' => ['sometimes', 'numeric', 'min:0'],
            'selling_price' => ['sometimes', 'numeric', 'min:0'],
            'wholesale_price' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'minimum_selling_price' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'tax_rate' => ['sometimes', 'numeric', 'min:0', 'max:100'],
            'is_tax_inclusive' => ['sometimes', 'boolean'],
            'discount_percent' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:100'],
            'reorder_level' => ['sometimes', 'integer', 'min:0'],
            'max_stock_level' => ['sometimes', 'nullable', 'integer', 'min:0'],
            'shelf_location' => ['sometimes', 'nullable', 'string', 'max:255'],
            'has_expiry' => ['sometimes', 'boolean'],
            'has_batch' => ['sometimes', 'boolean'],
            'has_serial' => ['sometimes', 'boolean'],
            'status' => ['sometimes', Rule::in(['active', 'inactive'])],
            'image' => ['sometimes', 'image', 'max:5120'],
            'generic_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'strength' => ['sometimes', 'nullable', 'string', 'max:100'],
            'dosage_form' => ['sometimes', 'nullable', Rule::in(\App\Support\Pharmacy\PharmacyCatalog::DOSAGE_FORMS)],
            'pack_size' => ['sometimes', 'nullable', 'string', 'max:100'],
            'manufacturer' => ['sometimes', 'nullable', 'string', 'max:255'],
            'requires_prescription' => ['sometimes', 'boolean'],
            'is_controlled' => ['sometimes', 'boolean'],
            'sold_by_weight' => ['sometimes', 'boolean'],
        ];
    }
}
