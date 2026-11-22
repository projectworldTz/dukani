<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * The tenant registry itself — deliberately NOT business-scoped (it has no
 * business_id of its own; it IS the businesses). Owned by the Platform Admin layer.
 *
 * SoftDeletes rather than a hard delete: a "deleted" shop is how the Platform Admin
 * fully decommissions a tenant while keeping every row it owns (sales, products, staff,
 * ...) intact and restorable — a hard delete would either cascade-destroy all of that or
 * orphan it. Because owner()/branches()/users() are all BelongsTo/HasMany against
 * business-scoped or otherwise-related models, Eloquent's default query behavior on a
 * soft-deleted Business already makes it vanish from normal lookups (see
 * PlatformController::destroy/restore for the explicit withTrashed() escape hatch).
 */
class Business extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'category',
        'slug',
        'owner_user_id',
        'currency',
        'timezone',
        'plan',
        'status',
        'license_expires_at',
        'license_expiry_alerted_at',
        'deletion_reason',
    ];

    protected function casts(): array
    {
        return [
            'license_expires_at' => 'datetime',
            'license_expiry_alerted_at' => 'datetime',
            'deleted_at' => 'datetime',
        ];
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_user_id');
    }

    /** 'pharmacy' / 'butchery' for those categories, otherwise the general POS. */
    public function platform(): string
    {
        return match (true) {
            \App\Support\Pharmacy\PharmacyCatalog::isPharmacy($this) => 'pharmacy',
            \App\Support\Butchery\ButcheryCatalog::isButchery($this) => 'butchery',
            default => 'general',
        };
    }

    public function isButchery(): bool
    {
        return $this->platform() === 'butchery';
    }

    public function isPharmacy(): bool
    {
        return $this->platform() === 'pharmacy';
    }

    public function settings(): HasOne
    {
        return $this->hasOne(BusinessSetting::class);
    }

    public function branches(): HasMany
    {
        return $this->hasMany(Branch::class);
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }
}
