<?php

namespace App\Providers;

use App\Models\PersonalAccessToken;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Laravel\Sanctum\Sanctum;
use Symfony\Component\Mailer\Transport;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Sanctum::usePersonalAccessTokenModel(PersonalAccessToken::class);

        // Brevo's HTTP API transport, not one of Laravel's built-in mailer keys --
        // see config/mail.php's 'brevo' entry for why (Truehost intercepts outbound
        // SMTP on every port, breaking the TLS handshake; plain HTTPS sidesteps it).
        Mail::extend('brevo', fn (array $config) => Transport::fromDsn('brevo+api://'.$config['key'].'@default'));

        RateLimiter::for('api', function ($request) {
            return Limit::perMinute(60)->by($request->user()?->id ?: $request->ip());
        });

        // Named per-endpoint, not one shared bucket: the built-in `throttle:N,M`
        // middleware signature ignores the route URI (see
        // Illuminate\Routing\Middleware\ThrottleRequests::resolveRequestSignature),
        // so unauthenticated auth routes on the same IP would otherwise all draw down
        // the exact same counter — a few failed logins could lock a user out of
        // "forgot password" too.
        foreach (['auth-register' => 6, 'auth-login' => 6, 'auth-forgot-password' => 6, 'auth-reset-password' => 6, 'auth-verify-email' => 10] as $name => $perMinute) {
            RateLimiter::for($name, fn ($request) => Limit::perMinute($perMinute)->by($request->ip()));
        }

        // Laravel's default ResetPassword notification reverse-routes to a
        // "password.reset" web route this API-only app doesn't have — point it at the
        // SPA's own reset-password screen instead. The token, not the URL, is the
        // security boundary here, so a plain (unsigned) query string is fine.
        ResetPassword::createUrlUsing(function ($notifiable, string $token) {
            return rtrim(config('app.frontend_url'), '/')
                .'/reset-password?token='.$token
                .'&email='.urlencode($notifiable->getEmailForPasswordReset());
        });

        // Flat JSON (no "data" envelope) for single-resource responses — collections
        // built from a paginator still get data/links/meta, which is unaffected by this.
        JsonResource::withoutWrapping();
    }
}
