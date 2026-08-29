<?php

use App\Http\Middleware\ResolveBusiness;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Routing\Middleware\SubstituteBindings;
use Spatie\Permission\Middleware\PermissionMiddleware;
use Spatie\Permission\Middleware\RoleMiddleware;
use Spatie\Permission\Middleware\RoleOrPermissionMiddleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // This is a pure JSON API with no `login` web route. Laravel's own default
        // (set before this callback runs) redirects unauthenticated guests to
        // route('login'), which doesn't exist here — that crashes with a 500
        // (RouteNotFoundException) for any request that doesn't itself send
        // Accept: application/json, before the exception handler ever sees it.
        $middleware->redirectGuestsTo(fn () => null);

        // Runs on every API request (no-op when unauthenticated — see the class docblock).
        $middleware->api(append: [ResolveBusiness::class]);

        // Spatie no longer self-registers these aliases as of Laravel 11+'s
        // bootstrap/app.php middleware config — required for `->middleware('permission:...')`.
        $middleware->alias([
            'role' => RoleMiddleware::class,
            'permission' => PermissionMiddleware::class,
            'role_or_permission' => RoleOrPermissionMiddleware::class,
        ]);

        // ResolveBusiness must run before SubstituteBindings, or implicit route-model
        // binding on a business-scoped model resolves before BusinessContext (and thus
        // BusinessScope) is set — a real bug, not a hypothetical one.
        $middleware->prependToPriorityList(
            before: SubstituteBindings::class,
            prepend: ResolveBusiness::class,
        );
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // This is a pure JSON API with no `login` web route, so any unauthenticated
        // request that doesn't itself send Accept: application/json (curl, a bare
        // browser hit, some HTTP clients) would otherwise crash with a 500 from
        // Laravel's default "redirect to login" handling instead of a clean 401.
        $exceptions->shouldRenderJsonWhen(fn ($request) => $request->is('api/*'));
    })->create();
