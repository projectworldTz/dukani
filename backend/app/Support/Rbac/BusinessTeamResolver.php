<?php

namespace App\Support\Rbac;

use App\Support\Tenancy\BusinessContext;
use Illuminate\Database\Eloquent\Model;
use Spatie\Permission\Contracts\PermissionsTeamResolver;

/**
 * Points Spatie's "teams" feature at BusinessContext instead of maintaining a second,
 * separate notion of "current tenant" — a business's roles/permissions are namespaced
 * by `business_id` the same way every other tenant-owned table is (see
 * App\Models\Concerns\BelongsToBusiness). This is why config/permission.php sets
 * `team_foreign_key` to `business_id` rather than the package default `team_id`.
 */
class BusinessTeamResolver implements PermissionsTeamResolver
{
    public function getPermissionsTeamId(): int|string|null
    {
        return BusinessContext::id();
    }

    public function setPermissionsTeamId($id): void
    {
        if ($id instanceof Model) {
            $id = $id->getKey();
        }

        BusinessContext::set($id);
    }
}
