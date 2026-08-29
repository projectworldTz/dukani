<?php

namespace App\Http\Middleware;

use App\Support\Tenancy\BusinessContext;
use Closure;
use Illuminate\Http\Request;
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
 */
class ResolveBusiness
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && $user->business_id) {
            BusinessContext::set($user->business_id);

            if ($user->business?->status !== 'active' && ! $request->is('api/v1/auth/logout')) {
                abort(403, 'This business account is suspended.');
            }
        }

        return $next($request);
    }
}
