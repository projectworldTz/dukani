<?php

namespace App\Http\Requests\Purchasing;

use App\Support\Tenancy\BusinessContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class RecordSupplierPaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('purchases.manage');
    }

    public function rules(): array
    {
        return [
            'amount' => ['required', 'numeric', 'min:0.01'],
            'payment_method_id' => ['nullable', 'integer', Rule::exists('payment_methods', 'id')->where('business_id', BusinessContext::id())],
            'reference' => ['nullable', 'string', 'max:255'],
        ];
    }
}
