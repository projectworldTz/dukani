<?php

namespace App\Http\Requests\Purchasing;

use App\Support\Tenancy\BusinessContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePurchaseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('purchases.manage');
    }

    public function rules(): array
    {
        $businessId = BusinessContext::id();

        return [
            'branch_id' => ['required', 'integer', Rule::exists('branches', 'id')->where('business_id', $businessId)],
            'supplier_id' => ['required', 'integer', Rule::exists('suppliers', 'id')->where('business_id', $businessId)],
            'notes' => ['nullable', 'string', 'max:1000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', Rule::exists('products', 'id')->where('business_id', $businessId)],
            'items.*.quantity_ordered' => ['required', 'integer', 'min:1'],
            'items.*.unit_cost' => ['required', 'numeric', 'min:0'],
            'items.*.tax_amount' => ['nullable', 'numeric', 'min:0'],
        ];
    }
}
