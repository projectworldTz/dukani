<?php

namespace App\Http\Requests\Sales;

use App\Support\Tenancy\BusinessContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CompleteHeldSaleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('sales.create');
    }

    public function rules(): array
    {
        $businessId = BusinessContext::id();

        return [
            'payments' => ['required', 'array'],
            'payments.*.payment_method_id' => ['required', 'integer', Rule::exists('payment_methods', 'id')->where('business_id', $businessId)],
            'payments.*.amount' => ['required', 'numeric', 'min:0.01'],
            'payments.*.reference' => ['nullable', 'string', 'max:255'],
            'redeem_points' => ['nullable', 'integer', 'min:0'],
        ];
    }
}
