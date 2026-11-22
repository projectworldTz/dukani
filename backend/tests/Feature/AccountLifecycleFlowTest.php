<?php

namespace Tests\Feature;

use App\Mail\LicenseExpiringMail;
use App\Mail\SaleReceiptMail;
use App\Mail\VerifyEmailMail;
use App\Models\Branch;
use App\Models\Business;
use App\Models\User;
use App\Support\Tenancy\BusinessContext;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Covers the account-lifecycle features added alongside licensing: password reset,
 * email verification, license-driven auto-suspension (and that it actually cuts off
 * already-issued tokens, not just new logins), session management, and emailing a
 * receipt to a customer.
 */
class AccountLifecycleFlowTest extends TestCase
{
    use RefreshDatabase;

    private function registerBusiness(string $email = 'nia@example.com'): array
    {
        Mail::fake();

        $response = $this->postJson('/api/v1/auth/register', [
            'business_name' => 'Mama Nia Shop',
            'owner_name' => 'Nia Mwangi',
            'email' => $email,
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])->assertCreated();

        return [$response->json('token'), $response->json('user'), Business::where('owner_user_id', $response->json('user.id'))->firstOrFail()];
    }

    private function asPlatformAdmin(): void
    {
        BusinessContext::set(null);
        $admin = User::factory()->create(['business_id' => null]);
        Sanctum::actingAs($admin, ['*']);
    }

    public function test_registration_sends_a_verification_email_and_the_link_verifies_the_account(): void
    {
        [, $owner] = $this->registerBusiness();

        Mail::assertSent(VerifyEmailMail::class, fn ($mail) => $mail->user->id === $owner['id']);

        $user = User::find($owner['id']);
        $this->assertNull($user->email_verified_at);
        $this->assertNotNull($user->email_verification_token);

        $this->postJson('/api/v1/auth/email/verify', [
            'email' => $user->email,
            'token' => 'wrong-token',
        ])->assertStatus(422);

        $this->postJson('/api/v1/auth/email/verify', [
            'email' => $user->email,
            'token' => $user->email_verification_token,
        ])->assertOk();

        $user->refresh();
        $this->assertNotNull($user->email_verified_at);
        $this->assertNull($user->email_verification_token);

        // A used/invalid token can't verify a second time.
        $this->postJson('/api/v1/auth/email/verify', [
            'email' => $user->email,
            'token' => $user->email_verification_token ?? 'anything',
        ])->assertStatus(422);
    }

    public function test_forgot_password_and_reset_password_round_trip(): void
    {
        Mail::fake();
        [, $owner] = $this->registerBusiness();
        $user = User::find($owner['id']);
        $oldToken = $user->createToken('possibly-compromised')->plainTextToken;

        // Unknown email still returns a generic success message (no enumeration).
        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'nobody@example.com'])->assertOk();

        $this->postJson('/api/v1/auth/forgot-password', ['email' => $user->email])->assertOk();

        $token = Password::broker()->createToken($user->fresh());

        $this->postJson('/api/v1/auth/reset-password', [
            'email' => $user->email,
            'token' => 'not-the-real-token',
            'password' => 'newpassword123',
            'password_confirmation' => 'newpassword123',
        ])->assertStatus(422);

        $this->postJson('/api/v1/auth/reset-password', [
            'email' => $user->email,
            'token' => $token,
            'password' => 'newpassword123',
            'password_confirmation' => 'newpassword123',
        ])->assertOk();

        $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'password123'])
            ->assertStatus(422);

        $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'newpassword123'])
            ->assertOk();

        $this->app['auth']->forgetGuards();
        $this->withToken($oldToken)->getJson('/api/v1/auth/me')->assertUnauthorized();
    }

    public function test_license_extension_stacks_onto_remaining_time_and_clears_the_alert_sentinel(): void
    {
        [, , $business] = $this->registerBusiness();
        $this->asPlatformAdmin();

        $this->postJson("/api/v1/platform/businesses/{$business->id}/extend-license", ['months' => 13])
            ->assertStatus(422);

        $this->postJson("/api/v1/platform/businesses/{$business->id}/extend-license", ['months' => 6])
            ->assertOk();

        $business->refresh();
        $this->assertTrue($business->license_expires_at->isFuture());
        $this->assertNull($business->license_expiry_alerted_at);

        $firstExpiry = $business->license_expires_at;

        // Extending again before the term lapses stacks onto the remaining time.
        $this->postJson("/api/v1/platform/businesses/{$business->id}/extend-license", ['months' => 6])->assertOk();
        $business->refresh();
        $this->assertTrue($business->license_expires_at->gt($firstExpiry));
    }

    public function test_login_sends_a_one_time_alert_once_the_license_has_thirty_days_or_less_left(): void
    {
        Mail::fake();
        [$ownerToken, $owner, $business] = $this->registerBusiness();
        // A paid license warns 30 days out (a free trial only in its last 3 days).
        $business->update(['plan' => 'paid', 'license_expires_at' => now()->addDays(10)]);

        $this->postJson('/api/v1/auth/login', ['email' => $owner['email'], 'password' => 'password123'])->assertOk();

        $this->assertNotNull($business->fresh()->license_expiry_alerted_at);
        $unread = $this->withToken($ownerToken)->getJson('/api/v1/notifications')->assertOk()->json();
        $this->assertTrue(collect($unread)->contains(fn ($n) => $n['type'] === 'license_expiring'));
        Mail::assertSent(LicenseExpiringMail::class);

        // A second login in the same window doesn't send a second alert.
        Mail::fake();
        $this->postJson('/api/v1/auth/login', ['email' => $owner['email'], 'password' => 'password123'])->assertOk();
        Mail::assertNotSent(LicenseExpiringMail::class);
    }

    public function test_an_expired_license_auto_suspends_the_business_and_cuts_off_an_already_issued_token(): void
    {
        [$ownerToken, $owner, $business] = $this->registerBusiness();

        // The token was issued while the business was still active/licensed.
        $this->withToken($ownerToken)->getJson('/api/v1/branches')->assertOk();

        $business->update(['plan' => 'paid', 'license_expires_at' => now()->subDay()]);

        $this->postJson('/api/v1/auth/login', ['email' => $owner['email'], 'password' => 'password123'])
            ->assertStatus(422)
            ->assertJsonFragment(['email' => ['This business license has expired. Please renew to continue.']]);

        $this->assertSame('suspended', $business->fresh()->status);

        // Auth::guard('sanctum') memoizes the user it resolves for the lifetime of the
        // test's container, which only real per-process request boundaries reset in
        // production (same class of gotcha as BusinessContext, see
        // OfflineResilienceAndPlatformAdminFlowTest) — force it to re-resolve so this
        // next call actually reflects the suspension applied above.
        $this->app['auth']->forgetGuards();

        // The token issued before expiry is now rejected too, not just new logins —
        // with 402 + how to pay, so the app can show its "subscription ended" screen.
        $this->withToken($ownerToken)->getJson('/api/v1/branches')->assertStatus(402)->assertJsonPath('code', 'subscription_expired');

        // Logout itself still works so a locked-out user isn't stuck.
        $this->withToken($ownerToken)->postJson('/api/v1/auth/logout')->assertOk();
    }

    public function test_user_can_list_and_revoke_their_own_sessions_but_not_the_current_one(): void
    {
        [$ownerToken, $owner] = $this->registerBusiness();
        $secondToken = User::find($owner['id'])->createToken('second-device')->plainTextToken;

        $sessions = $this->withToken($ownerToken)->getJson('/api/v1/auth/sessions')->assertOk()->json();
        $this->assertCount(2, $sessions);

        $other = collect($sessions)->firstWhere('is_current', false);
        $current = collect($sessions)->firstWhere('is_current', true);

        $this->withToken($ownerToken)->deleteJson("/api/v1/auth/sessions/{$current['id']}")->assertStatus(422);
        $this->withToken($ownerToken)->deleteJson("/api/v1/auth/sessions/{$other['id']}")->assertOk();

        // See the comment in the license-expiry test — the sanctum guard memoizes
        // whatever user it first resolved for this test's container, so it must be
        // forced to re-resolve to actually see the just-revoked token as gone.
        $this->app['auth']->forgetGuards();
        $this->withToken($secondToken)->getJson('/api/v1/auth/me')->assertStatus(401);
    }

    public function test_receipt_can_be_emailed_to_a_customer(): void
    {
        Mail::fake();
        [$ownerToken] = $this->registerBusiness();
        $branch = Branch::firstOrFail();

        $product = $this->withToken($ownerToken)->postJson('/api/v1/products', [
            'name' => 'Rice 25kg', 'cost_price' => 30000, 'selling_price' => 40000,
        ])->json();

        $this->withToken($ownerToken)->postJson("/api/v1/products/{$product['id']}/stock/adjust", [
            'branch_id' => $branch->id, 'quantity_change' => 5, 'type' => 'opening_stock',
        ])->assertCreated();

        $cashMethodId = collect($this->withToken($ownerToken)->getJson('/api/v1/payment-methods')->json())
            ->firstWhere('type', 'cash')['id'];

        $sale = $this->withToken($ownerToken)->postJson('/api/v1/sales', [
            'branch_id' => $branch->id,
            'items' => [['product_id' => $product['id'], 'quantity' => 1]],
            'payments' => [['payment_method_id' => $cashMethodId, 'amount' => 40000]],
        ])->assertCreated()->json();

        $this->withToken($ownerToken)->postJson("/api/v1/sales/{$sale['id']}/receipt/email", [])
            ->assertStatus(422);

        $this->withToken($ownerToken)->postJson("/api/v1/sales/{$sale['id']}/receipt/email", [
            'email' => 'customer@example.com',
        ])->assertOk();

        Mail::assertSent(SaleReceiptMail::class, fn ($mail) => $mail->sale->id === $sale['id']);
    }

    public function test_audit_log_is_visible_to_roles_manage_and_records_permission_changes(): void
    {
        [$ownerToken] = $this->registerBusiness();

        $roles = $this->withToken($ownerToken)->getJson('/api/v1/roles')->assertOk()->json();
        $cashier = collect($roles)->firstWhere('name', 'Cashier');

        $this->withToken($ownerToken)->putJson("/api/v1/roles/{$cashier['id']}/permissions", [
            'permissions' => ['sales.create'],
        ])->assertOk();

        $logs = $this->withToken($ownerToken)->getJson('/api/v1/audit-logs')->assertOk()->json();
        $this->assertTrue(collect($logs['data'])->contains(fn ($l) => $l['action'] === 'role.permissions_updated'));
    }
}
