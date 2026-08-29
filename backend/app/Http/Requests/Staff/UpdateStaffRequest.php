<?php

namespace App\Http\Requests\Staff;

use App\Support\Tenancy\BusinessContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateStaffRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('staff.manage');
    }

    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'max:255'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:30'],
            'branch_id' => ['sometimes', 'nullable', 'integer', Rule::exists('branches', 'id')->where('business_id', BusinessContext::id())],
            'job_title' => ['sometimes', 'nullable', 'string', 'max:255'],
            'status' => ['sometimes', Rule::in(['active', 'inactive'])],
            'roles' => ['sometimes', 'array', 'min:1'],
            'roles.*' => ['string'],
        ];
    }
}
