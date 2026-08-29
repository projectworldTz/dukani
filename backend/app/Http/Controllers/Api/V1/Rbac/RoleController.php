<?php

namespace App\Http\Controllers\Api\V1\Rbac;

use App\Http\Controllers\Controller;
use App\Http\Requests\Rbac\SetRoleLimitRequest;
use App\Http\Requests\Rbac\StoreRoleRequest;
use App\Http\Requests\Rbac\UpdateRolePermissionsRequest;
use App\Models\Role;
use App\Models\RoleLimit;
use App\Services\Audit\AuditLogger;
use App\Services\Rbac\RoleService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RoleController extends Controller
{
    public function __construct(private RoleService $roleService, private AuditLogger $auditLogger) {}

    public function permissionCatalog()
    {
        return config('pos-permissions');
    }

    public function index(Request $request)
    {
        abort_unless($request->user()->can('roles.manage'), 403);

        // Not ->withCount('users'): Spatie's Role::users() morphedByMany relation reads
        // $this->attributes['guard_name'] to resolve the related model, but withCount()
        // builds its subquery against an unconstrained/attribute-less model instance,
        // so the guard (and therefore the related model class) can't resolve — a
        // Spatie+teams edge case, not something wrong with our own data. A direct
        // pivot-table count sidesteps it.
        $userCounts = DB::table('model_has_roles')
            ->select('role_id', DB::raw('count(*) as aggregate'))
            ->groupBy('role_id')
            ->pluck('aggregate', 'role_id');

        return Role::with('permissions:id,name')
            ->get()
            ->map(fn (Role $role) => [
                'id' => $role->id,
                'name' => $role->name,
                'is_protected' => $role->name === 'Business Owner',
                'permissions' => $role->permissions->pluck('name'),
                'users_count' => $userCounts[$role->id] ?? 0,
                'limits' => RoleLimit::where('role_id', $role->id)->get(['key', 'value']),
            ]);
    }

    public function store(StoreRoleRequest $request)
    {
        $role = $this->roleService->createCustomRole(
            $request->user()->business,
            $request->validated('name'),
            $request->validated('permissions', [])
        );

        return response()->json($role, 201);
    }

    public function updatePermissions(UpdateRolePermissionsRequest $request, Role $role)
    {
        $oldPermissions = $role->permissions()->pluck('name')->all();

        $this->roleService->updateRolePermissions($role, $request->validated('permissions'), $request->user()->business);

        $this->auditLogger->log(
            'role.permissions_updated',
            $role,
            oldValues: ['permissions' => $oldPermissions],
            newValues: ['permissions' => $request->validated('permissions')],
            request: $request,
        );

        return $role->load('permissions:id,name');
    }

    public function setLimit(SetRoleLimitRequest $request, Role $role)
    {
        $limit = $this->roleService->setRoleLimit(
            $request->user()->business,
            $role,
            $request->validated('key'),
            (float) $request->validated('value'),
        );

        return response()->json($limit, 201);
    }
}
