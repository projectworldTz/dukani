<?php

namespace App\Http\Controllers\Api\V1\Audit;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\Request;

/**
 * Gated on roles.manage rather than a dedicated permission: viewing the audit trail
 * and viewing/editing roles are both "trusted admin" concerns, and reusing it avoids a
 * catalog change that would need backfilling onto every business created before it
 * (see App\Services\Rbac\RolePermissionSeederService — new permissions only reach
 * existing roles if something explicitly regrants them).
 */
class AuditLogController extends Controller
{
    public function index(Request $request)
    {
        abort_unless($request->user()->can('roles.manage'), 403);

        return AuditLog::with('user:id,name')
            ->when($request->filled('action'), fn ($q) => $q->where('action', 'like', $request->string('action').'%'))
            ->when($request->filled('user_id'), fn ($q) => $q->where('user_id', $request->integer('user_id')))
            ->orderByDesc('created_at')
            ->paginate($request->integer('per_page', 25));
    }
}
