<?php

namespace App\Models\Scopes;

use App\Support\Tenancy\BusinessContext;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;

/**
 * Three states, mirroring BusinessContext:
 *
 *   1. BusinessContext::isPlatformMode() — scope is suspended, every business's rows
 *      visible. Only reachable via BusinessContext::runAsPlatform().
 *   2. BusinessContext::check() — a business is set, only that business's rows visible.
 *   3. Neither — deny by default: only platform-level rows (business_id IS NULL) are
 *      visible, e.g. a Platform Admin's own user account.
 */
class BusinessScope implements Scope
{
    public function apply(Builder $builder, Model $model): void
    {
        if (BusinessContext::isPlatformMode()) {
            return;
        }

        $column = $model->getTable().'.business_id';

        if (BusinessContext::check()) {
            $builder->where($column, BusinessContext::id());
        } else {
            $builder->whereNull($column);
        }
    }
}
