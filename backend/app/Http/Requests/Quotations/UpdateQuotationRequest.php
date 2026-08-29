<?php

namespace App\Http\Requests\Quotations;

use App\Support\Tenancy\BusinessContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateQuotationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('quotations.manage');
    }

    public function rules(): array
    {
        $businessId = BusinessContext::id();

        return [
            'branch_id' => ['sometimes', 'integer', Rule::exists('branches', 'id')->where('business_id', $businessId)],
            'customer_id' => ['sometimes', 'nullable', 'integer', Rule::exists('customers', 'id')->where('business_id', $businessId)],
            'customer_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'valid_until' => ['sometimes', 'nullable', 'date'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'payment_terms' => ['sometimes', 'nullable', 'string', 'max:255'],
            'items' => ['sometimes', 'array', 'min:1'],
            'items.*.product_id' => ['required_with:items', 'integer', Rule::exists('products', 'id')->where('business_id', $businessId)],
            'items.*.quantity' => ['required_with:items', 'integer', 'min:1'],
            'items.*.unit_price' => ['nullable', 'numeric', 'min:0'],
            'items.*.discount_amount' => ['nullable', 'numeric', 'min:0'],
        ];
    }
}
