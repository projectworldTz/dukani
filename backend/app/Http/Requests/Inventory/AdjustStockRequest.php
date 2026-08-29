<?php

namespace App\Http\Requests\Inventory;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AdjustStockRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('inventory.adjust');
    }

    public function rules(): array
    {
        return [
            'branch_id' => ['required', 'integer', 'exists:branches,id'],
            'quantity_change' => ['required', 'integer', 'not_in:0'],
            'type' => ['required', Rule::in(['opening_stock', 'adjustment', 'damaged', 'expired', 'lost', 'stolen'])],
            'reason' => ['nullable', 'string', 'max:500'],
        ];
    }
}
