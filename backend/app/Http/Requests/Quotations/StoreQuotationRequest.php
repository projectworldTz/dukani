<?php

namespace App\Http\Requests\Quotations;

use App\Support\Tenancy\BusinessContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreQuotationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('quotations.manage');
    }

    public function rules(): array
    {
        $businessId = BusinessContext::id();

        return [
            'branch_id' => ['required', 'integer', Rule::exists('branches', 'id')->where('business_id', $businessId)],
            'customer_id' => ['nullable', 'integer', Rule::exists('customers', 'id')->where('business_id', $businessId)],
            'customer_name' => ['nullable', 'string', 'max:255'],
            'valid_until' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'payment_terms' => ['nullable', 'string', 'max:255'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', Rule::exists('products', 'id')->where('business_id', $businessId)],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'items.*.unit_price' => ['nullable', 'numeric', 'min:0'],
            'items.*.discount_amount' => ['nullable', 'numeric', 'min:0'],
        ];
    }
}
