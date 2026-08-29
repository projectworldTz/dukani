<?php

namespace App\Http\Controllers\Api\V1\Platform;

use App\Http\Controllers\Controller;
use App\Http\Resources\AuthenticatedUserResource;
use App\Models\Business;
use App\Models\Sale;
use App\Models\Scopes\BusinessScope;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use App\Support\Tenancy\BusinessContext;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Spec §33/§53's SaaS platform layer: the Platform Admin (a User with business_id
 * null) manages the tenant registry. `Business` itself carries no BelongsToBusiness
 * scope — it IS the registry, not a tenant-owned table — so it's queryable directly;
 * only the cross-tenant stats query below needs BusinessContext::runAsPlatform() to
 * see through every business's own Sale scope.
 */
class PlatformController extends Controller
{
    public function __construct(private AuditLogger $auditLogger) {}

    private function assertPlatformAdmin(Request $request): void
    {
        abort_unless($request->user()->isPlatformAdmin(), 403, 'Platform Admin access only.');
    }

    public function businesses(Request $request)
    {
        $this->assertPlatformAdmin($request);

        // withCount('users') builds a subquery against User, which is itself
        // business-scoped (BelongsToBusiness) — without platform mode, that subquery's
        // own BusinessScope silently applies its deny-by-default "whereNull(business_id)"
        // and every row would read users_count: 0, same bug the cross-tenant stats()
        // query below already works around.
        return BusinessContext::runAsPlatform(function () use ($request) {
            return Business::withCount('users')
                ->when($request->boolean('trashed'), fn ($q) => $q->onlyTrashed(), fn ($q) => $q)
                ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
                ->orderByDesc('created_at')
                ->paginate($request->integer('per_page', 20));
        });
    }

    /**
     * Full detail view for one business, including the owner's contact info — used by
     * the Platform Admin dashboard's "view business" panel. Needs platform mode for the
     * same reason businesses() above does: owner (a User) and branches are both
     * business-scoped models. Takes a raw id and looks up withTrashed() (like
     * restore()) rather than a route-bound Business, so a deleted business's "Deleted
     * businesses" tab can still open its detail view instead of 404ing.
     */
    public function show(Request $request, int $businessId)
    {
        $this->assertPlatformAdmin($request);

        return BusinessContext::runAsPlatform(function () use ($businessId) {
            $business = Business::withTrashed()->findOrFail($businessId);
            $business->load(['owner:id,name,email,phone,created_at', 'branches:id,business_id,name,code,is_main,status']);
            $staffCount = $business->users()->count();

            return [
                'id' => $business->id,
                'name' => $business->name,
                'slug' => $business->slug,
                'category' => $business->category,
                'currency' => $business->currency,
                'timezone' => $business->timezone,
                'plan' => $business->plan,
                'status' => $business->status,
                'deleted_at' => $business->deleted_at,
                'deletion_reason' => $business->deletion_reason,
                'license_expires_at' => $business->license_expires_at,
                'created_at' => $business->created_at,
                'staff_count' => $staffCount,
                'branches' => $business->branches,
                'owner' => $business->owner ? [
                    'name' => $business->owner->name,
                    'email' => $business->owner->email,
                    'phone' => $business->owner->phone,
                    'joined_at' => $business->owner->created_at,
                ] : null,
            ];
        });
    }

    public function updateBusinessStatus(Request $request, Business $business)
    {
        $this->assertPlatformAdmin($request);

        $data = $request->validate(['status' => ['required', Rule::in(['active', 'suspended'])]]);
        $oldStatus = $business->status;
        $business->update(['status' => $data['status']]);

        $this->auditLogger->log(
            'business.status_updated',
            $business,
            oldValues: ['status' => $oldStatus],
            newValues: ['status' => $data['status']],
            request: $request,
        );

        return $business;
    }

    /**
     * Extends from the later of "now" or the current expiry, so renewing early
     * (before the old term lapses) stacks onto the remaining time instead of
     * discarding it. Clears the alerted-at sentinel so the "1 month left" notice
     * (see AuthController::login) can fire again for the new expiry date.
     */
    public function extendLicense(Request $request, Business $business)
    {
        $this->assertPlatformAdmin($request);

        $data = $request->validate(['months' => ['required', Rule::in([6, 12])]]);

        $oldExpiry = $business->license_expires_at;
        $base = $business->license_expires_at?->isFuture() ? $business->license_expires_at : now();
        $business->update([
            'license_expires_at' => $base->copy()->addMonths($data['months']),
            'license_expiry_alerted_at' => null,
        ]);

        $this->auditLogger->log(
            'business.license_extended',
            $business,
            oldValues: ['license_expires_at' => $oldExpiry?->toDateTimeString()],
            newValues: ['license_expires_at' => $business->license_expires_at->toDateTimeString(), 'months' => $data['months']],
            request: $request,
        );

        return $business;
    }

    /**
     * Soft delete only — every row the business owns (sales, products, staff, ...)
     * stays intact and is restorable via restore() below; nothing is hard-deleted.
     * SoftDeletes on Business means owner()/branches()/users() (and the login/
     * ResolveBusiness checks in AuthController/ResolveBusiness) already stop resolving
     * this business the instant it's deleted — the same "business not active" path a
     * suspension takes, so an already-logged-in session is cut off too, not just new
     * logins. A reason is mandatory — this is a full account shutdown, not a routine
     * status flip, and it's kept on the row itself (not just the audit log) so the
     * "Deleted businesses" list can show why at a glance.
     */
    public function destroy(Request $request, Business $business)
    {
        $this->assertPlatformAdmin($request);

        $data = $request->validate(['reason' => ['required', 'string', 'max:1000']]);

        $this->auditLogger->log(
            'business.deleted',
            $business,
            oldValues: ['status' => $business->status],
            newValues: ['reason' => $data['reason']],
            request: $request,
        );

        $business->update(['deletion_reason' => $data['reason']]);
        $business->delete();

        return response()->json(['message' => "{$business->name} has been deleted."]);
    }

    /**
     * Route-model binding won't resolve a soft-deleted row (SoftDeletingScope hides it
     * the same way it hides everything else), so this takes a raw id and looks it up
     * with withTrashed() explicitly rather than typing the parameter as Business. Also
     * requires a reason — restoring access to a previously shut-down account is just as
     * consequential as deleting it, and the audit log is the only place this one is
     * kept (deletion_reason is cleared since it no longer describes the current state).
     */
    public function restore(Request $request, int $businessId)
    {
        $this->assertPlatformAdmin($request);

        $data = $request->validate(['reason' => ['required', 'string', 'max:1000']]);

        $business = Business::withTrashed()->findOrFail($businessId);
        abort_unless($business->trashed(), 422, 'This business is not deleted.');

        $this->auditLogger->log(
            'business.restored',
            $business,
            oldValues: ['deletion_reason' => $business->deletion_reason],
            newValues: ['reason' => $data['reason']],
            request: $request,
        );

        $business->restore();
        $business->update(['deletion_reason' => null]);

        return $business;
    }

    /**
     * "View as Owner": issues a short-lived Sanctum token for the business's owner so
     * the Platform Admin can browse/support the app exactly as that owner sees it --
     * the standard "log in as customer" pattern, reusing the whole app instead of a
     * separate read-only view. The admin's own token is left untouched; the frontend
     * holds onto it and swaps back on "Exit impersonation" without a fresh login.
     * Deliberately full owner access, not read-only -- restricting it would just make
     * this useless for the actual support scenarios it exists for (walking through a
     * client's real data entry, reproducing a bug they hit) -- so the token expires in
     * an hour and every use is audit logged (business_id null, a platform-level action
     * like suspend/delete) for accountability over what is otherwise unrestricted
     * access to a client's live business.
     */
    public function impersonate(Request $request, Business $business)
    {
        $this->assertPlatformAdmin($request);

        abort_if($business->trashed(), 404);

        $owner = BusinessContext::runAsPlatform(
            fn () => User::withoutGlobalScope(BusinessScope::class)->find($business->owner_user_id)
        );
        abort_unless($owner, 404, 'This business has no owner account.');

        $this->auditLogger->log(
            'business.impersonated',
            $business,
            newValues: ['owner_id' => $owner->id, 'owner_email' => $owner->email],
            request: $request,
        );

        BusinessContext::set($business->id);
        $owner->load('business');
        $token = $owner->createToken('platform-impersonation', ['*'], now()->addHour())->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => new AuthenticatedUserResource($owner),
        ]);
    }

    public function stats(Request $request)
    {
        $this->assertPlatformAdmin($request);

        return BusinessContext::runAsPlatform(function () {
            return [
                'total_businesses' => Business::count(),
                'active_businesses' => Business::where('status', 'active')->count(),
                'suspended_businesses' => Business::where('status', 'suspended')->count(),
                'businesses_with_a_sale_last_30_days' => Sale::where('status', 'completed')
                    ->where('completed_at', '>=', now()->subDays(30))
                    ->distinct('business_id')
                    ->count('business_id'),
                'total_completed_sales' => Sale::where('status', 'completed')->count(),
            ];
        });
    }
}
