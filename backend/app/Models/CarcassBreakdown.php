<?php

namespace App\Models;

use App\Models\Concerns\BelongsToBusiness;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A whole carcass cut up into saleable cuts, with yield and cost per kg. */
class CarcassBreakdown extends Model
{
    use BelongsToBusiness;

    protected $fillable = [
        'business_id', 'branch_id', 'description', 'carcass_weight_g', 'total_cost',
        'yield_weight_g', 'cost_per_kg', 'lines', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'lines' => 'array',
            'total_cost' => 'decimal:2',
            'cost_per_kg' => 'decimal:2',
            'carcass_weight_g' => 'integer',
            'yield_weight_g' => 'integer',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
