<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Spatie\Permission\PermissionRegistrar;

abstract class TestCase extends BaseTestCase
{
    /**
     * Spatie caches its whole roles/permissions pivot collection under one cache key,
     * independent of RefreshDatabase — without this, a later test can silently reuse a
     * stale cache built (and never invalidated) by an earlier test in the same process,
     * seeing role ids/permission grants that no longer exist after the DB was wiped.
     */
    protected function setUp(): void
    {
        parent::setUp();

        $this->app->make(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
