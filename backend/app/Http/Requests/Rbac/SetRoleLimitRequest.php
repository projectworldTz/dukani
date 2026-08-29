<?php

namespace App\Http\Requests\Rbac;

use Illuminate\Foundation\Http\FormRequest;

class SetRoleLimitRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('roles.manage');
    }

    public function rules(): array
    {
        return [
            'key' => ['required', 'string', 'max:255'],
            'value' => ['required', 'numeric', 'min:0'],
        ];
    }
}
