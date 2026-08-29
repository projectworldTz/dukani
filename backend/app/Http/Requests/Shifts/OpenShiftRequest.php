<?php

namespace App\Http\Requests\Shifts;

use App\Support\Tenancy\BusinessContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class OpenShiftRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('shifts.open');
    }

    public function rules(): array
    {
        return [
            'branch_id' => ['required', 'integer', Rule::exists('branches', 'id')->where('business_id', BusinessContext::id())],
            'opening_cash' => ['required', 'numeric', 'min:0'],
        ];
    }
}
