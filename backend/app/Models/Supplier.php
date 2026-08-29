<?php

namespace App\Models;

use App\Models\Concerns\BelongsToBusiness;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Supplier extends Model
{
    use BelongsToBusiness;

    protected $fillable = [
        'business_id', 'name', 'contact_person', 'phone', 'email', 'address', 'tin',
    ];

    public function purchases(): HasMany
    {
        return $this->hasMany(Purchase::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(SupplierPayment::class);
    }

    /** Total invoiced minus total paid, across every non-cancelled purchase. */
    public function outstandingBalance(): float
    {
        $totals = $this->purchases()->where('status', '!=', 'cancelled')->selectRaw('COALESCE(SUM(grand_total), 0) as invoiced, COALESCE(SUM(amount_paid), 0) as paid')->first();

        return (float) $totals->invoiced - (float) $totals->paid;
    }
}
