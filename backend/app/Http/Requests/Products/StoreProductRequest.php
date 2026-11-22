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

            // Optional stock already on the shelf when the product is first added, so a
            // new shop can create a product and start selling it in one step.

            // Pharmacy medicine details.
            'generic_name' => ['nullable', 'string', 'max:255'],
            'strength' => ['nullable', 'string', 'max:100'],
            'dosage_form' => ['nullable', Rule::in(\App\Support\Pharmacy\PharmacyCatalog::DOSAGE_FORMS)],
            'pack_size' => ['nullable', 'string', 'max:100'],
            'manufacturer' => ['nullable', 'string', 'max:255'],
            'requires_prescription' => ['nullable', 'boolean'],
            'is_controlled' => ['nullable', 'boolean'],
            // Butchery: priced per kg, stock kept in grams.
            'sold_by_weight' => ['nullable', 'boolean'],
            'opening_batch_number' => ['nullable', 'string', 'max:100'],
            'opening_expiry_date' => ['nullable', 'date', 'after_or_equal:today'],

            'opening_stock' => ['nullable', 'integer', 'min:0'],
            'branch_id' => ['nullable', 'integer', Rule::exists('branches', 'id')->where('business_id', $businessId)],
        ];
    }

    public function after(): array
    {
        return [
            function ($validator) {
                if ((int) $this->input('opening_stock', 0) > 0 && ! $this->user()->can('inventory.adjust')) {
                    $validator->errors()->add('opening_stock', 'You do not have permission to add stock.');
                }

                // A pharmacy's first stock of a medicine must say which batch it is and when it expires.
                if ((int) $this->input('opening_stock', 0) > 0 && $this->user()->business->isPharmacy()) {
                    if (blank($this->input('opening_batch_number'))) {
                        $validator->errors()->add('opening_batch_number', 'Enter the batch number printed on the pack.');
                    }
                    if (blank($this->input('opening_expiry_date'))) {
                        $validator->errors()->add('opening_expiry_date', 'Enter the expiry date printed on the pack.');
                    }
                }
            },
        ];
    }
}
