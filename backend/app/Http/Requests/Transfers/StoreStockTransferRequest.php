<?php

namespace App\Http\Requests\Transfers;

use App\Support\Tenancy\BusinessContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreStockTransferRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('stock_transfers.manage');
    }

    public function rules(): array
    {
        $businessId = BusinessContext::id();

        return [
            'from_branch_id' => ['required', 'integer', Rule::exists('branches', 'id')->where('business_id', $businessId)],
            'to_branch_id' => ['required', 'integer', 'different:from_branch_id', Rule::exists('branches', 'id')->where('business_id', $businessId)],
            'notes' => ['nullable', 'string', 'max:1000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', Rule::exists('products', 'id')->where('business_id', $businessId)],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
        ];
    }
}
