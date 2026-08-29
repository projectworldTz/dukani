<?php

namespace App\Http\Requests\Sales;

use App\Support\Tenancy\BusinessContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreSaleReturnRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('sales.return');
    }

    public function rules(): array
    {
        return [
            'refund_payment_method_id' => ['nullable', 'integer', Rule::exists('payment_methods', 'id')->where('business_id', BusinessContext::id())],
            'reason' => ['nullable', 'string', 'max:1000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.sale_item_id' => ['required', 'integer'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'items.*.condition' => ['required', Rule::in(['sellable', 'damaged'])],
        ];
    }
}
