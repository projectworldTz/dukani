<?php

namespace App\Services\Audit;

use App\Models\AuditLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

class AuditLogger
{
    public function log(
        string $action,
        ?Model $auditable = null,
        array $oldValues = [],
        array $newValues = [],
        ?Request $request = null,
    ): AuditLog {
        $request ??= request();
        $user = $request->user();

        return AuditLog::create([
            'business_id' => $user?->business_id,
            'user_id' => $user?->id,
            'action' => $action,
            'auditable_type' => $auditable?->getMorphClass(),
            'auditable_id' => $auditable?->getKey(),
            'old_values' => $oldValues ?: null,
            'new_values' => $newValues ?: null,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);
    }
}
