<?php

namespace App\Models;

use App\Models\Concerns\BelongsToBusiness;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** The prescription a prescription-only sale was dispensed against. */
class Prescription extends Model
{
    use BelongsToBusiness;

    protected $fillable = [
        'business_id', 'sale_id', 'rx_number', 'prescriber_name', 'prescriber_reg_no', 'facility',
        'issued_on', 'patient_name', 'patient_age', 'patient_phone', 'notes', 'recorded_by',
    ];

    protected function casts(): array
    {
        return ['issued_on' => 'date', 'patient_age' => 'integer'];
    }

    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
