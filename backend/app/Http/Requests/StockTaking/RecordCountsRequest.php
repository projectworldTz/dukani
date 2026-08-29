<?php

namespace App\Http\Requests\StockTaking;

use Illuminate\Foundation\Http\FormRequest;

class RecordCountsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('stock_takes.manage');
    }

    public function rules(): array
    {
        return [
            'counts' => ['required', 'array', 'min:1'],
            'counts.*.item_id' => ['required', 'integer'],
            'counts.*.counted_quantity' => ['required', 'integer', 'min:0'],
        ];
    }
}
