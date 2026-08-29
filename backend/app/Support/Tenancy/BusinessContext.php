<?php

namespace App\Support\Tenancy;

use Closure;

/**
 * Single source of truth for "which business is this request operating as".
 *
 * Tenant isolation is enforced at the application layer by the Eloquent global scope
 * in BelongsToBusiness, which reads BusinessContext::id() (and isPlatformMode()) on
 * every query — plus, since Spatie's team resolver (config/permission.php) proxies to
 * this same class, role/permission checks are namespaced by business the same way.
 *
 * There is currently no database-level backstop (Postgres Row-Level Security could add
 * one later) — a query that bypasses Eloquent (raw DB::table() calls, a forgotten scope)
 * is not protected. Keep all business-scoped data access going through Eloquent models
 * that use BelongsToBusiness.
 */
class BusinessContext
{
    protected static int|string|null $currentBusinessId = null;

    protected static bool $platformMode = false;

    public static function id(): int|string|null
    {
        return static::$currentBusinessId;
    }

    public static function check(): bool
    {
        return static::$currentBusinessId !== null;
    }

    public static function isPlatformMode(): bool
    {
        return static::$platformMode;
    }

    public static function set(int|string|null $businessId): void
    {
        static::$currentBusinessId = $businessId;
    }

    /**
     * Run a callback with the business global scope suspended entirely (every
     * business's rows visible). Reserved for Platform Admin code paths that
     * legitimately need cross-business visibility (platform analytics, resolving a
     * user before their business is known) and for CLI contexts such as seeders.
     *
     * Callers are responsible for having already authorized the caller as Platform
     * Admin before reaching for this; it is a data-access escape hatch, not an
     * authorization check.
     */
    public static function runAsPlatform(Closure $callback): mixed
    {
        $previous = static::$platformMode;
        static::$platformMode = true;

        try {
            return $callback();
        } finally {
            static::$platformMode = $previous;
        }
    }
}
