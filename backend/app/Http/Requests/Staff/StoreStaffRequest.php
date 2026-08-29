<?php

namespace App\Http\Requests\Staff;

use App\Support\Tenancy\BusinessContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreStaffRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('staff.manage');
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'phone' => ['nullable', 'string', 'max:30'],
            'branch_id' => ['nullable', 'integer', Rule::exists('branches', 'id')->where('business_id', BusinessContext::id())],
            'job_title' => ['nullable', 'string', 'max:255'],
            'password' => ['nullable', 'string', 'min:8'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
            'roles' => ['required', 'array', 'min:1'],
            'roles.*' => ['string'],
        ];
    }
}
