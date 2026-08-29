<?php

namespace App\Http\Requests\Business;

use Illuminate\Foundation\Http\FormRequest;

class UpdateBusinessSettingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('business.settings.manage');
    }

    public function rules(): array
    {
        return [
            'address' => ['sometimes', 'nullable', 'string', 'max:255'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:30'],
            'email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'tin' => ['sometimes', 'nullable', 'string', 'max:50'],
            'vrn' => ['sometimes', 'nullable', 'string', 'max:50'],
            'tax_inclusive_pricing' => ['sometimes', 'boolean'],
            'default_tax_rate' => ['sometimes', 'numeric', 'min:0', 'max:100'],
            'receipt_footer_text' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'currency' => ['sometimes', 'string', 'size:3'],
            'loyalty_enabled' => ['sometimes', 'boolean'],
            'loyalty_spend_per_point' => ['sometimes', 'numeric', 'min:0.01'],
            'loyalty_point_value' => ['sometimes', 'numeric', 'min:0'],
        ];
    }
}
