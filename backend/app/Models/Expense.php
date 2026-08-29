<?php

namespace App\Models;

use App\Models\Concerns\BelongsToBusiness;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Expense extends Model
{
    use BelongsToBusiness;

    protected $fillable = [
        'business_id', 'branch_id', 'expense_category_id', 'amount', 'description',
        'date', 'payment_method_id', 'document_path', 'created_by',
    ];

    protected function casts(): array
    {
        return ['amount' => 'decimal:2', 'date' => 'date'];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(ExpenseCategory::class, 'expense_category_id');
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function paymentMethod(): BelongsTo
    {
        return $this->belongsTo(PaymentMethod::class);
    }
}
