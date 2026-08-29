<?php

namespace App\Http\Requests\Shifts;

use Illuminate\Foundation\Http\FormRequest;

class CloseShiftRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('shifts.close') && $this->route('cashierShift')->user_id === $this->user()->id;
    }

    public function rules(): array
    {
        return [
            'closing_cash' => ['required', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
