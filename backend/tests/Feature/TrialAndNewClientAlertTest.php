<?php

namespace Tests\Feature;

use App\Mail\NewClientRegisteredMail;
use App\Models\Business;
use App\Models\User;
use App\Services\Notifications\SmsSender;
use App\Support\Tenancy\BusinessContext;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TrialAndNewClientAlertTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config([
            'dukani.trial_days' => 14,
            'dukani.alerts.emails' => ['owner@projectworld.test'],
            'dukani.alerts.phones' => ['0712 345 678'],
            'dukani.subscription_contact' => ['name' => 'Dukani Sales', 'phone' => '0712 345 678', 'whatsapp' => '0712 345 678', 'email' => 'sales@projectworld.test', 'payment_info' => 'M-Pesa Lipa 123456'],
            'dukani.sms.driver' => 'beem',
            'dukani.sms.beem' => ['api_key' => 'k', 'secret_key' => 's'],
        ]);
    }

    private function register(string $email = 'kelvin@example.com'): array
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'business_name' => 'Today Pharmacy', 'business_category' => 'Pharmacy & Health', 'owner_name' => 'Kelvin Mikida',
            'email' => $email, 'phone' => '0754 111 222', 'password' => 'password123', 'password_confirmation' => 'password123',
        ])->assertCreated();

        return [$response->json('token'), Business::findOrFail($response->json('user.business.id')), $response->json()];
    }

    public function test_new_registration_gets_a_14_day_trial_and_alerts_the_platform_owner_by_email_and_sms(): void
    {
        Mail::fake();
        Http::fake(['apisms.beem.africa/*' => Http::response(['successful' => true])]);

        [, $business, $data] = $this->register();

        $this->assertSame('trial', $business->plan);
        $this->assertEqualsWithDelta(now()->addDays(14)->timestamp, $business->license_expires_at->timestamp, 5);
        $this->assertTrue($data['user']['business']['subscription']['is_trial']);
        $this->assertSame(13, $data['user']['business']['subscription']['days_left']);
        $this->assertSame('M-Pesa Lipa 123456', $data['user']['business']['subscription']['contact']['payment_info']);

        Mail::assertSent(NewClientRegisteredMail::class, fn ($m) => $m->hasTo('owner@projectworld.test') && $m->business->is($business));

        Http::assertSent(function ($request) {
            $body = $request->data();

            return str_contains($request->url(), 'apisms.beem.africa')
                && $body['recipients'][0]['dest_addr'] === '255712345678'
                && str_contains($body['message'], 'New client registered')
                && str_contains($body['message'], 'Today Pharmacy')
                && str_contains($body['message'], '0754 111 222');
        });
    }

    public function test_a_failing_sms_gateway_never_breaks_registration_or_the_email(): void
    {
        Mail::fake();
        Http::fake(['*' => Http::response('gateway down', 500)]);

        $this->register();

        Mail::assertSent(NewClientRegisteredMail::class);
    }

    public function test_an_ended_trial_locks_open_sessions_and_login_with_payment_details_until_extended(): void
    {
        Mail::fake();
        Http::fake();
        [$token, $business] = $this->register();
        $this->withToken($token)->getJson('/api/v1/branches')->assertOk();

        $this->travel(15)->days();
        $this->app['auth']->forgetGuards();
        // A session that is still open when the trial runs out (tokens themselves expire
        // after 14 days, so issue one "now" — it is the trial that must lock it).
        $token = User::where('email', 'kelvin@example.com')->firstOrFail()->createToken('open-session')->plainTextToken;

        // Already-open session: locked straight away, with how to pay.
        $this->withToken($token)->getJson('/api/v1/branches')
            ->assertStatus(402)
            ->assertJsonPath('code', 'subscription_expired')
            ->assertJsonPath('subscription.contact.phone', '0712 345 678');
        $this->withToken($token)->postJson('/api/v1/auth/logout')->assertOk();
        $this->app['auth']->forgetGuards();

        // New login: refused with the trial message and the contact phone.
        $message = $this->postJson('/api/v1/auth/login', ['email' => 'kelvin@example.com', 'password' => 'password123'])
            ->assertStatus(422)->json('errors.email.0');
        $this->assertStringContainsString('14-day free trial has ended', $message);
        $this->assertStringContainsString('0712 345 678', $message);

        // The client pays; the platform admin extends by 1 month → paid and open again.
        BusinessContext::set(null); // so business_id stays null for the platform admin
        $admin = User::factory()->create(['business_id' => null]);
        $this->flushHeaders();
        Sanctum::actingAs($admin, ['*']);
        $this->postJson("/api/v1/platform/businesses/{$business->id}/extend-license", ['months' => 1])->assertOk();
        $this->app['auth']->forgetGuards();

        $business->refresh();
        $this->assertSame('paid', $business->plan);
        $this->assertSame('active', $business->status);
        $this->assertTrue($business->license_expires_at->isFuture());

        $login = $this->postJson('/api/v1/auth/login', ['email' => 'kelvin@example.com', 'password' => 'password123'])->assertOk();
        $this->assertFalse($login->json('user.business.subscription.is_trial'));
        $this->withToken($login->json('token'))->getJson('/api/v1/branches')->assertOk();
    }

    public function test_trial_reminder_only_comes_in_the_last_three_days(): void
    {
        Mail::fake();
        Http::fake();
        [, $business] = $this->register();

        $this->postJson('/api/v1/auth/login', ['email' => 'kelvin@example.com', 'password' => 'password123'])->assertOk();
        $this->assertNull($business->fresh()->license_expiry_alerted_at);

        $this->travel(12)->days();
        $this->postJson('/api/v1/auth/login', ['email' => 'kelvin@example.com', 'password' => 'password123'])->assertOk();
        $this->assertNotNull($business->fresh()->license_expiry_alerted_at);
    }

    public function test_client_gets_one_subscribe_reminder_sms_two_days_after_registering(): void
    {
        Mail::fake();
        Http::fake(['apisms.beem.africa/*' => Http::response(['successful' => true])]);
        [, $business] = $this->register();
        [, $paid] = $this->register('paid@example.com');
        $paid->update(['plan' => 'paid']);
        $toClient = fn () => collect(Http::recorded())->filter(fn ($pair) => ($pair[0]->data()['recipients'][0]['dest_addr'] ?? null) === '255754111222' && str_contains($pair[0]->data()['message'], 'free trial ends'));

        // Day 1: too early.
        $this->travel(1)->days();
        $this->artisan('dukani:trial-reminders')->assertSuccessful();
        $this->assertCount(0, $toClient());

        // Day 2: the trial client is texted on their own phone, with how to pay.
        $this->travel(1)->days();
        $this->artisan('dukani:trial-reminders')->assertSuccessful();
        $this->assertCount(1, $toClient());
        $message = $toClient()->first()[0]->data()['message'];
        $this->assertStringContainsString('Hello Kelvin', $message);
        $this->assertStringContainsString('M-Pesa Lipa 123456', $message);
        $this->assertNotNull($business->fresh()->trial_reminder_sent_at);
        $this->assertNull($paid->fresh()->trial_reminder_sent_at);

        // Never twice.
        $this->travel(3)->hours();
        $this->artisan('dukani:trial-reminders')->assertSuccessful();
        $this->assertCount(1, $toClient());
    }

    public function test_phone_numbers_are_normalised_for_sms(): void
    {
        $this->assertSame('255712345678', SmsSender::normalise('0712 345 678'));
        $this->assertSame('255712345678', SmsSender::normalise('+255 712-345-678'));
        $this->assertSame('255712345678', SmsSender::normalise('712345678'));
        $this->assertSame('254712345678', SmsSender::normalise('00254712345678'));
        $this->assertNull(SmsSender::normalise('12'));
    }
}
