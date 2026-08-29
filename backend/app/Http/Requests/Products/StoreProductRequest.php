<?php

namespace App\Http\Requests\Products;

use App\Support\Tenancy\BusinessContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('products.manage');
    }

    public function rules(): array
    {
        $businessId = BusinessContext::id();

        return [
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'sku' => ['nullable', 'string', 'max:100', Rule::unique('products', 'sku')->where('business_id', $businessId)],
            'category_id' => ['nullable', 'integer', Rule::exists('product_categories', 'id')->where('business_id', $businessId)],
            'brand_id' => ['nullable', 'integer', Rule::exists('brands', 'id')->where('business_id', $businessId)],
            'unit_id' => ['nullable', 'integer', Rule::exists('units', 'id')->where('business_id', $businessId)],
            'supplier_id' => ['nullable', 'integer', Rule::exists('suppliers', 'id')->where('business_id', $businessId)],
            'cost_price' => ['required', 'numeric', 'min:0'],
            'selling_price' => ['required', 'numeric', 'min:0'],
            'wholesale_price' => ['nullable', 'numeric', 'min:0'],
            'minimum_selling_price' => ['nullable', 'numeric', 'min:0'],
            'tax_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'is_tax_inclusive' => ['nullable', 'boolean'],
            'discount_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'reorder_level' => ['nullable', 'integer', 'min:0'],
            'max_stock_level' => ['nullable', 'integer', 'min:0'],
            'shelf_location' => ['nullable', 'string', 'max:255'],
            'has_expiry' => ['nullable', 'boolean'],
            'has_batch' => ['nullable', 'boolean'],
            'has_serial' => ['nullable', 'boolean'],
            'image' => ['nullable', 'image', 'max:5120'],
            // Barcode: either enter a manufacturer code manually, or ask the server to
            // generate an internal PRD###### one — not both.
            'barcode' => ['nullable', 'string', 'max:64', 'required_with:barcode_type', 'prohibits:generate_barcode'],
            'barcode_type' => ['nullable', Rule::in(['EAN13', 'EAN8', 'UPCA', 'UPCE', 'CODE128'])],
            'generate_barcode' => ['nullable', 'boolean'],
        ];
    }
}
