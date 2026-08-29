<?php

namespace App\Models;

use App\Support\Tenancy\BusinessContext;
use Illuminate\Database\Eloquent\Builder;
use Spatie\Permission\Models\Role as SpatieRole;

/**
 * Spatie's own Role model has no per-team scoping on a plain lookup (Role::find($id),
 * used by route-model-binding on `{role}`) — only its own findOrCreate()/findByName()
 * helpers filter by team, via a WHERE clause built at call time, not a persistent
 * scope. Without this, a business-scoped route like PUT /roles/{role}/permissions
 * would let any authenticated user reference another business's role by guessing its
 * id. This global scope closes that gap the same way BusinessScope does for our own
 * models: visible rows are this business's roles, or team-less global roles.
 * Registered via config/permission.php's `models.role`.
 */
class Role extends SpatieRole
{
    protected static function booted(): void
    {
        static::addGlobalScope('business', function (Builder $builder) {
            if (BusinessContext::isPlatformMode()) {
                return;
            }

            $column = $builder->getModel()->getTable().'.business_id';

            $builder->where(fn ($q) => $q->whereNull($column)->orWhere($column, BusinessContext::id()));
        });
    }
}
