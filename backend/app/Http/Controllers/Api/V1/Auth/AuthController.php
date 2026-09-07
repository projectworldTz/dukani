<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterBusinessRequest;
use App\Http\Resources\AuthenticatedUserResource;
use App\Mail\LicenseExpiringMail;
use App\Mail\VerifyEmailMail;
use App\Models\Business;
use App\Models\BusinessNotification;
use App\Models\Scopes\BusinessScope;
use App\Models\User;
use App\Services\Business\BusinessRegistrationService;
use App\Support\Tenancy\BusinessContext;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function __construct(private BusinessRegistrationService $registrationService) {}

    public function register(RegisterBusinessRequest $request)
    {
        [$business, $owner] = $this->registrationService->register($request->validated());

        BusinessContext::set($business->id);
        $owner->load('business');
        $this->sendVerificationEmail($owner);
        $token = $owner->createToken('dukani')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => new AuthenticatedUserResource($owner),
        ], 201);
    }

    public function login(LoginRequest $request)
    {
        // Login is inherently a cross-tenant lookup — at this point we don't yet know
        // which business the email belongs to, so BusinessScope's deny-by-default
        // state (no rows visible without a set business) would hide every business
        // user. This bypass is deliberate and narrow: email is unique platform-wide,
        // and the password check below still fully gates access.
        $user = User::withoutGlobalScope(BusinessScope::class)
            ->where('email', $request->string('email'))
            ->first();

        if (! $user || ! Hash::check($request->string('password'), $user->password)) {
            throw ValidationException::withMessages([
                'email' => __('These credentials do not match our records.'),
            ]);
        }

        if ($user->status !== 'active') {
            throw ValidationException::withMessages([
                'email' => __('This account has been deactivated.'),
            ]);
        }

        if ($user->business_id) {
            $this->autoSuspendIfLicenseExpired($user->business);
        }

        if ($user->business_id && $user->business?->status !== 'active') {
            throw ValidationException::withMessages([
                'email' => __($user->business?->license_expires_at?->isPast()
                    ? 'This business license has expired. Please renew to continue.'
                    : 'This business account is suspended.'),
            ]);
        }

        BusinessContext::set($user->business_id);
        $user->load('business');
        $this->notifyIfLicenseExpiringSoon($user->business);
        $token = $user->createToken('dukani')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => new AuthenticatedUserResource($user),
        ]);
    }

    /**
     * Flips a business to suspended the first time someone tries to log in after its
     * license has lapsed — mirrors the platform admin's manual "Suspend" action so an
     * expired license can't be worked around by simply never suspending it. Already
     * -issued tokens are cut off separately by the EnsureBusinessActive middleware,
     * since this only runs at the login boundary.
     */
    private function autoSuspendIfLicenseExpired(?Business $business): void
    {
        if (! $business || $business->status !== 'active') {
            return;
        }

        if (! $business->license_expires_at || ! $business->license_expires_at->isPast()) {
            return;
        }

        $business->update(['status' => 'suspended']);
    }

    /**
     * Notifies once, the first login after the license drops to <=30 days remaining,
     * not on every login while it stays in that window — license_expiry_alerted_at is
     * the crossing sentinel, mirroring StockMovementService::notifyIfCrossedLowStock.
     * It's cleared whenever the license is extended (PlatformController::extendLicense)
     * so the next expiry cycle can alert again.
     */
    private function notifyIfLicenseExpiringSoon(?Business $business): void
    {
        if (! $business || ! $business->license_expires_at || $business->license_expiry_alerted_at) {
            return;
        }

        if (! $business->license_expires_at->isFuture() || $business->license_expires_at->diffInDays(now()) > 30) {
            return;
        }

        BusinessNotification::create([
            'business_id' => $business->id,
            'type' => 'license_expiring',
            'title' => 'License renewal due soon',
            'message' => "Your Dukani license expires on {$business->license_expires_at->format('d M Y')}. Please renew to avoid interruption.",
        ]);

        $business->update(['license_expiry_alerted_at' => now()]);

        if ($ownerEmail = $business->owner?->email) {
            Mail::to($ownerEmail)->send(new LicenseExpiringMail($business));
        }
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out.']);
    }

    public function me(Request $request)
    {
        $user = $request->user()->load('business');

        return new AuthenticatedUserResource($user);
    }

    public function forgotPassword(Request $request)
    {
        $request->validate(['email' => ['required', 'email']]);

        $user = User::withoutGlobalScope(BusinessScope::class)
            ->where('email', $request->string('email'))
            ->first();

        // Same response whether or not the email is registered, so this endpoint can't
        // be used to enumerate accounts.
        if ($user) {
            $token = Password::broker()->createToken($user);
            $user->sendPasswordResetNotification($token);
        }

        return response()->json([
            'message' => __('If that email address is registered, a password reset link has been sent.'),
        ]);
    }

    public function resetPassword(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'token' => ['required', 'string'],
            'password' => ['required', 'confirmed', PasswordRule::min(8)],
        ]);

        $user = User::withoutGlobalScope(BusinessScope::class)
            ->where('email', $data['email'])
            ->first();

        if (! $user || ! Password::broker()->tokenExists($user, $data['token'])) {
            throw ValidationException::withMessages([
                'email' => __('This password reset link is invalid or has expired.'),
            ]);
        }

        $user->forceFill(['password' => $data['password']])->save();
        Password::broker()->deleteToken($user);
        // A password reset is an account-recovery boundary. Any bearer token that
        // may have been copied before the reset must stop working immediately.
        $user->tokens()->delete();

        return response()->json(['message' => __('Your password has been reset. You can now sign in.')]);
    }

    /**
     * Never lets a mail-transport failure bubble up: registration's business/owner/
     * branch are already committed to the DB by the time this runs, so a broken
     * mailer (e.g. missing BREVO_API_KEY) must not turn a successful signup into a
     * 500 the user can't recover from — they'd retry and hit "email already taken"
     * for an account they can't yet access. Failures are still reported/logged.
     */
    private function sendVerificationEmail(User $user): void
    {
        if ($user->hasVerifiedEmail()) {
            return;
        }

        $token = Str::random(40);
        $user->update(['email_verification_token' => $token]);

        try {
            Mail::to($user->email)->send(new VerifyEmailMail($user, $token));
        } catch (\Throwable $e) {
            report($e);
        }
    }

    public function verifyEmail(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'token' => ['required', 'string'],
        ]);

        $user = User::withoutGlobalScope(BusinessScope::class)
            ->where('email', $data['email'])
            ->where('email_verification_token', $data['token'])
            ->first();

        if (! $user) {
            throw ValidationException::withMessages([
                'email' => __('This verification link is invalid or has already been used.'),
            ]);
        }

        $user->update(['email_verified_at' => now(), 'email_verification_token' => null]);

        return response()->json(['message' => __('Your email has been verified.')]);
    }

    public function resendVerificationEmail(Request $request)
    {
        $user = $request->user();

        if ($user->hasVerifiedEmail()) {
            return response()->json(['message' => __('Your email is already verified.')]);
        }

        $this->sendVerificationEmail($user);

        return response()->json(['message' => __('Verification email sent.')]);
    }

    /**
     * "Active sessions" as seen by the user: one row per Sanctum personal access
     * token, newest-used first, with the token backing the current request flagged
     * so the frontend can hide/disable revoking it (that's what logout is for).
     */
    public function sessions(Request $request)
    {
        $currentId = $request->user()->currentAccessToken()?->id;

        return $request->user()->tokens()
            ->orderByDesc('last_used_at')
            ->get()
            ->map(fn ($token) => [
                'id' => $token->id,
                'name' => $token->name,
                'last_used_at' => $token->last_used_at,
                'created_at' => $token->created_at,
                'is_current' => $token->id === $currentId,
            ])
            ->values();
    }

    public function revokeSession(Request $request, int $tokenId)
    {
        $token = $request->user()->tokens()->where('id', $tokenId)->first();
        abort_unless($token, 404);
        abort_if($token->id === $request->user()->currentAccessToken()?->id, 422, 'Cannot revoke the session you are currently using — use logout instead.');

        $token->delete();

        return response()->json(['message' => 'Session revoked.']);
    }
}
