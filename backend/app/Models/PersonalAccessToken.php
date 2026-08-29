<?php

namespace App\Models;

use App\Support\Tenancy\BusinessContext;
use Laravel\Sanctum\PersonalAccessToken as SanctumPersonalAccessToken;

/**
 * Sanctum resolves a bearer token's owning User (the `tokenable` relation) before
 * ResolveBusiness middleware has run — so BusinessContext isn't set yet at that
 * point. User is scoped by BusinessScope (see BelongsToBusiness), which is
 * deny-by-default with no context set, so the lookup silently returns null and
 * every bearer-token request looks unauthenticated. Same class of problem
 * AuthController::login() already works around for its own cross-tenant lookup;
 * runAsPlatform() is the same escape hatch, scoped to just this one relation.
 */
class PersonalAccessToken extends SanctumPersonalAccessToken
{
    public function getRelationValue($key)
    {
        if ($key === 'tokenable') {
            return BusinessContext::runAsPlatform(fn () => parent::getRelationValue($key));
        }

        return parent::getRelationValue($key);
    }
}
