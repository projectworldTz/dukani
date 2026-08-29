<?php

namespace App\Services\Rbac;

use App\Models\Business;
use App\Models\Role;
use App\Models\RoleLimit;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Spatie\Permission\Models\Permission;

/**
 * Assigning/revoking roles goes through here rather than straight to Spatie's
 * `$user->assignRole()`, specifically to enforce one rule the permission table can't
 * express on its own: only an existing Business Owner may create or promote another
 * Business Owner (spec's explicit "protected role" requirement). Everything else
 * (Manager/Cashier/Storekeeper, and any custom role a Business Owner defines) has no
 * such restriction — a user may hold any combination of them at once.
 */
class RoleService
{
    public function syncRoles(User $target, array $roleNames, User $actor): void
    {
        $wantsOwnerRole = in_array('Business Owner', $roleNames, true);
        $hadOwnerRole = $target->hasRole('Business Owner');

        if ($wantsOwnerRole && ! $hadOwnerRole && ! $actor->hasRole('Business Owner')) {
            throw ValidationException::withMessages([
                'roles' => 'Only a Business Owner can grant the Business Owner role.',
            ]);
        }

        $target->syncRoles($roleNames);
    }

    public function updateRolePermissions(Role $role, array $permissionNames, Business $business): void
    {
        if ($role->name === 'Business Owner') {
            throw ValidationException::withMessages([
                'permissions' => 'The Business Owner role always has full access and cannot be edited.',
            ]);
        }

        $role->syncPermissions($permissionNames);
    }

    public function setRoleLimit(Business $business, Role $role, string $key, float $value): RoleLimit
    {
        return RoleLimit::updateOrCreate(
            ['business_id' => $business->id, 'role_id' => $role->id, 'key' => $key],
            ['value' => $value],
        );
    }

    public function createCustomRole(Business $business, string $name, array $permissionNames): Role
    {
        if ($name === 'Business Owner') {
            throw ValidationException::withMessages([
                'name' => 'That role name is reserved.',
            ]);
        }

        return DB::transaction(function () use ($name, $permissionNames) {
            $role = Role::findOrCreate($name, 'web');
            $role->syncPermissions(Permission::whereIn('name', $permissionNames)->get());

            return $role;
        });
    }
}
