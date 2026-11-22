<?php

namespace App\Models;

use App\Models\Concerns\BelongsToBusiness;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Customer extends Model
{
    use BelongsToBusiness;

    protected $fillable = [
        'business_id', 'name', 'phone', 'email', 'address', 'customer_type', 'credit_limit', 'loyalty_points', 'notes',
    ];

    protected function casts(): array
    {
        return ['credit_limit' => 'decimal:2'];
    }

    public function sales(): HasMany
    {
        return $this->hasMany(Sale::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(CustomerPayment::class);
    }

    public function loyaltyTransactions(): HasMany
    {
        return $this->hasMany(LoyaltyTransaction::class);
    }

    /** Total owed across all not-fully-paid completed sales — this is the "credit" spec §23 tracks. */
    public function outstandingBalance(): float
    {
        // Per sale, only the unpaid part counts: cash handed over beyond the total came
        // back as change, so it must never show up as credit in the customer's favour.
        $owed = $this->sales()
            ->whereIn('status', ['completed', 'partially_refunded'])
            ->selectRaw('COALESCE(SUM(CASE WHEN grand_total > amount_paid THEN grand_total - amount_paid ELSE 0 END), 0) as owed')
            ->value('owed');

        return round((float) $owed, 2);
    }

    public function availableCredit(): float
    {
        return (float) $this->credit_limit - $this->outstandingBalance();
    }
}
