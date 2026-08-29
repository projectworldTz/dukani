<?php

namespace App\Http\Requests\StockTaking;

use App\Support\Tenancy\BusinessContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreStockTakeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('stock_takes.manage');
    }

    public function rules(): array
    {
        $businessId = BusinessContext::id();

        return [
            'branch_id' => ['required', 'integer', Rule::exists('branches', 'id')->where('business_id', $businessId)],
            'product_ids' => ['required', 'array', 'min:1'],
            'product_ids.*' => ['integer', Rule::exists('products', 'id')->where('business_id', $businessId)],
        ];
    }
}
