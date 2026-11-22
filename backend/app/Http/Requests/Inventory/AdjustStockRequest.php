<?php

namespace App\Http\Requests\Inventory;

use App\Support\Tenancy\BusinessContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * One endpoint for every simple stock action a shopkeeper needs:
 *  - "Add stock"   → type=purchase, positive quantity_change, optional unit_cost
 *  - "Remove stock"→ type=damaged|expired|lost|stolen, negative quantity_change
 *  - "Fix count"   → type=adjustment, counted_quantity (the absolute number on the shelf)
 */
class AdjustStockRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('inventory.adjust');
    }

    public function rules(): array
    {
        return [
            'branch_id' => ['required', 'integer', Rule::exists('branches', 'id')->where('business_id', BusinessContext::id())],
            'quantity_change' => ['required_without:counted_quantity', 'prohibits:counted_quantity', 'nullable', 'integer', 'not_in:0'],
            'counted_quantity' => ['nullable', 'integer', 'min:0'],
            'type' => ['required', Rule::in(['opening_stock', 'purchase', 'adjustment', 'damaged', 'expired', 'lost', 'stolen'])],
            'unit_cost' => ['nullable', 'numeric', 'min:0'],
            'reason' => ['nullable', 'string', 'max:500'],

            // Pharmacy: which batch is arriving (and when it expires) or which batch to remove from.
            'batch_number' => ['nullable', 'string', 'max:100'],
            'expiry_date' => ['nullable', 'date'],
            'manufactured_at' => ['nullable', 'date', 'before_or_equal:today'],
            'batch_id' => ['nullable', 'integer', Rule::exists('product_batches', 'id')->where('business_id', BusinessContext::id())],
        ];
    }

    public function after(): array
    {
        return [
            function ($validator) {
                $change = $this->input('quantity_change');
                $type = $this->input('type');

                if ($change === null || $validator->errors()->isNotEmpty()) {
                    return;
                }

                if (in_array($type, ['opening_stock', 'purchase'], true) && (int) $change < 0) {
                    $validator->errors()->add('quantity_change', 'Adding stock needs a positive quantity.');
                }

                if (in_array($type, ['damaged', 'expired', 'lost', 'stolen'], true) && (int) $change > 0) {
                    $validator->errors()->add('quantity_change', 'Removing stock needs a negative quantity.');
                }
            },
        ];
    }
}
