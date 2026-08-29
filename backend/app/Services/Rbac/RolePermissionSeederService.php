<?php

namespace App\Services\Rbac;

use App\Models\Business;
use App\Models\Role;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;

/**
 * Seeds the 4 default roles (Business Owner, Manager, Cashier, Storekeeper) for a
 * newly created business, each with a sensible starting permission set. Because
 * Spatie's "teams" feature scopes roles by business_id (see
 * App\Support\Rbac\BusinessTeamResolver), this creates a copy of these roles that is
 * entirely private to this business — the Business Owner can later add/remove
 * permissions on their own copy via App\Services\Rbac\RoleService without touching any
 * other business's roles of the same name.
 */
class RolePermissionSeederService
{
    /**
     * Default permission sets, chosen per the spec's own descriptions of each role.
     * Business Owner gets every catalog permission (computed, not listed, so it never
     * drifts out of date as the catalog grows).
     */
    private const DEFAULT_MANAGER_PERMISSIONS = [
        'branches.view.all', 'products.manage', 'inventory.view',
        'sales.view.all', 'sales.discount.apply', 'sales.credit.apply', 'sales.return', 'receipts.reprint',
        'shifts.view.all', 'purchases.manage', 'stock_transfers.approve', 'stock_takes.approve',
        'customers.manage', 'quotations.manage', 'expenses.manage',
    ];

    private const DEFAULT_CASHIER_PERMISSIONS = [
        'sales.create', 'sales.view.own', 'sales.credit.apply', 'receipts.reprint',
        'shifts.open', 'shifts.close', 'customers.manage', 'quotations.manage',
    ];

    private const DEFAULT_STOREKEEPER_PERMISSIONS = [
        'products.manage', 'inventory.view', 'inventory.adjust', 'suppliers.manage',
        'purchases.manage', 'purchases.receive', 'stock_transfers.manage', 'stock_takes.manage',
    ];

    public function seedPermissionCatalog(): void
    {
        foreach (config('pos-permissions') as $module) {
            foreach (array_keys($module) as $name) {
                Permission::findOrCreate($name, 'web');
            }
        }
    }

    public function seedDefaultRolesFor(Business $business): void
    {
        $this->seedPermissionCatalog();

        /** @var PermissionRegistrar $registrar */
        $registrar = app(PermissionRegistrar::class);
        $registrar->setPermissionsTeamId($business->id);

        $allPermissions = array_keys(array_merge(...array_values(config('pos-permissions'))));

        $this->createRoleWithPermissions('Business Owner', $allPermissions);
        $this->createRoleWithPermissions('Manager', self::DEFAULT_MANAGER_PERMISSIONS);
        $this->createRoleWithPermissions('Cashier', self::DEFAULT_CASHIER_PERMISSIONS);
        $this->createRoleWithPermissions('Storekeeper', self::DEFAULT_STOREKEEPER_PERMISSIONS);

        $registrar->forgetCachedPermissions();
    }

    private function createRoleWithPermissions(string $name, array $permissions): void
    {
        $role = Role::findOrCreate($name, 'web');
        $role->syncPermissions($permissions);
    }
}
