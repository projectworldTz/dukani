<?php

namespace App\Http\Middleware;

use App\Support\Tenancy\BusinessContext;
use Closure;
use Illuminate\Http\Request;
use Spatie\Permission\PermissionRegistrar;
use Symfony\Component\HttpFoundation\Response;

/**
 * Sets BusinessContext from the authenticated user's business_id for the rest of the
 * request lifecycle. Since App\Support\Rbac\BusinessTeamResolver reads BusinessContext
 * live, this single call also namespaces every Spatie role/permission check for the
 * request — no separate `setPermissionsTeamId()` call needed.
 *
 * Must run before Laravel's SubstituteBindings middleware, or implicit route-model
 * binding on a business-scoped model resolves without the tenant scope applied yet
 * (a real gotcha, not a hypothetical one — see the priority registration in
 * bootstrap/app.php). Platform Admin users (business_id === null) leave the context
 * unset, matching BusinessScope's deny-by-default state for platform-level rows.
 *
 * Also the enforcement point for a suspended (or license-expired, which
 * AuthController::login auto-suspends into the same status) business: login only
 * blocks new sessions, so without this a token issued before suspension would keep
 * working for its full lifetime. `/auth/logout` stays reachable so a locked-out user
 * can still clear their own session.
 *
 * The Spatie permission cache is flushed here on purpose: it's a single cache entry
 * shared across every team, not one per business, so whichever business's request
 * happens to populate it first "poisons" the cache for every other business for up
 * to 24h (config/permission.php cache.expiration_time) -- every other tenant's
 * hasPermissionTo()/can() checks then silently return false even though the role
 * really does have the permission (getAllPermissions() still reads correctly, since
 * it doesn't go through this cache the same way, which is what makes this bug so
 * confusing to diagnose from the symptom alone). Forcing a rebuild scoped to the
 * current team on every request costs one extra query per request but guarantees
 * every business always sees its own, correct permission set.
 */
class ResolveBusiness
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && $user->business_id) {
            BusinessContext::set($user->business_id);
            app(PermissionRegistrar::class)->forgetCachedPermissions();

            if ($user->business?->status !== 'active' && ! $request->is('api/v1/auth/logout')) {
                abort(403, 'This business account is suspended.');
            }
        }

        return $next($request);
    }
}
