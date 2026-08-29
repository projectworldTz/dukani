<?php

namespace App\Http\Requests\Customers;

use App\Support\Tenancy\BusinessContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class RecordCustomerPaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('customers.manage');
    }

    public function rules(): array
    {
        $businessId = BusinessContext::id();

        return [
            'sale_id' => ['required', 'integer', Rule::exists('sales', 'id')->where('business_id', $businessId)],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'payment_method_id' => ['nullable', 'integer', Rule::exists('payment_methods', 'id')->where('business_id', $businessId)],
            'reference' => ['nullable', 'string', 'max:255'],
        ];
    }
}
