<?php

namespace App\Http\Requests\Purchasing;

use Illuminate\Foundation\Http\FormRequest;

class ReceivePurchaseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('purchases.receive');
    }

    public function rules(): array
    {
        return [
            'receipts' => ['required', 'array', 'min:1'],
            'receipts.*.purchase_item_id' => ['required', 'integer'],
            'receipts.*.quantity' => ['required', 'integer', 'min:1'],
            'receipts.*.batch_number' => ['nullable', 'string', 'max:100'],
            'receipts.*.expiry_date' => ['nullable', 'date'],
        ];
    }
}
