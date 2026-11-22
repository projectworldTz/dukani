<?php

namespace App\Http\Requests\Sales;

use App\Support\Tenancy\BusinessContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreSaleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('sales.create');
    }

    public function rules(): array
    {
        $businessId = BusinessContext::id();

        return [
            'branch_id' => ['required', 'integer', Rule::exists('branches', 'id')->where('business_id', $businessId)],
            'shift_id' => ['nullable', 'integer', Rule::exists('cashier_shifts', 'id')->where('business_id', $businessId)->where('status', 'open')],
            'customer_id' => ['nullable', 'integer', Rule::exists('customers', 'id')->where('business_id', $businessId)],
            'customer_name' => ['nullable', 'string', 'max:255'],
            'customer_phone' => ['nullable', 'string', 'max:30'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'hold' => ['nullable', 'boolean'],
            'redeem_points' => ['nullable', 'integer', 'min:0'],
            'idempotency_key' => ['nullable', 'string', 'max:255'],

            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', Rule::exists('products', 'id')->where('business_id', $businessId)],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'items.*.discount_amount' => ['nullable', 'numeric', 'min:0'],
            'items.*.dosage_instructions' => ['nullable', 'string', 'max:255'],

            // Pharmacy: required by SaleService when the cart has prescription-only medicines.
            'prescription' => ['nullable', 'array'],
            'prescription.rx_number' => ['nullable', 'string', 'max:100'],
            'prescription.prescriber_name' => ['nullable', 'string', 'max:255'],
            'prescription.prescriber_reg_no' => ['nullable', 'string', 'max:100'],
            'prescription.facility' => ['nullable', 'string', 'max:255'],
            'prescription.issued_on' => ['nullable', 'date', 'before_or_equal:today'],
            'prescription.patient_name' => ['nullable', 'string', 'max:255'],
            'prescription.patient_age' => ['nullable', 'integer', 'min:0', 'max:130'],
            'prescription.patient_phone' => ['nullable', 'string', 'max:30'],
            'prescription.notes' => ['nullable', 'string', 'max:1000'],

            'payments' => ['exclude_if:hold,true', 'present', 'array'],
            'payments.*.payment_method_id' => ['required_with:payments', 'integer', Rule::exists('payment_methods', 'id')->where('business_id', $businessId)],
            'payments.*.amount' => ['required_with:payments', 'numeric', 'min:0.01'],
            'payments.*.reference' => ['nullable', 'string', 'max:255'],
        ];
    }
}
