<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Business;
use App\Models\Product;
use App\Models\User;
use App\Support\Tenancy\BusinessContext;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Phase 7: a retried checkout (spec §42) must not ring up twice, and the Platform Admin
 * (a User with business_id null, spec §33/§53) manages the tenant registry across
 * businesses without being subject to any single business's own scoping.
 */
class OfflineResilienceAndPlatformAdminFlowTest extends TestCase
{
    use RefreshDatabase;

    private function registerBusiness(string $email = 'nia@example.com'): array
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'business_name' => 'Mama Nia Shop',
            'owner_name' => 'Nia Mwangi',
            'email' => $email,
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])->assertCreated();

        return [$response->json('token'), $response->json('user'), Business::where('owner_user_id', $response->json('user.id'))->firstOrFail()];
    }

    public function test_retried_sale_with_same_idempotency_key_is_not_duplicated(): void
    {
        [$ownerToken] = $this->registerBusiness();
        $branch = Branch::firstOrFail();

        $product = $this->withToken($ownerToken)->postJson('/api/v1/products', [
            'name' => 'Cooking Oil 5L', 'cost_price' => 15000, 'selling_price' => 20000,
        ])->json();

        $this->withToken($ownerToken)->postJson("/api/v1/products/{$product['id']}/stock/adjust", [
            'branch_id' => $branch->id, 'quantity_change' => 10, 'type' => 'opening_stock',
        ])->assertCreated();

        $methods = $this->withToken($ownerToken)->getJson('/api/v1/payment-methods')->json();
        $cashMethodId = collect($methods)->firstWhere('type', 'cash')['id'];

        $payload = [
            'branch_id' => $branch->id,
            'idempotency_key' => 'client-generated-key-abc123',
            'items' => [['product_id' => $product['id'], 'quantity' => 1]],
            'payments' => [['payment_method_id' => $cashMethodId, 'amount' => 20000]],
        ];

        $first = $this->withToken($ownerToken)->postJson('/api/v1/sales', $payload)->assertCreated()->json();

        // Client times out waiting for the response and retries with the identical key.
        $second = $this->withToken($ownerToken)->postJson('/api/v1/sales', $payload)->assertCreated()->json();

        $this->assertSame($first['id'], $second['id']);
        $this->assertSame($first['receipt_number'], $second['receipt_number']);

        $product = Product::find($product['id']);
        $this->assertSame(9, $product->inventories()->where('branch_id', $branch->id)->value('quantity'));
    }

    public function test_a_regular_business_user_cannot_reach_platform_admin_endpoints(): void
    {
        [$ownerToken] = $this->registerBusiness();

        $this->withToken($ownerToken)->getJson('/api/v1/platform/businesses')->assertStatus(403);
        $this->withToken($ownerToken)->getJson('/api/v1/platform/stats')->assertStatus(403);
    }

    public function test_platform_admin_can_list_and_suspend_businesses_and_see_cross_tenant_stats(): void
    {
        $this->registerBusiness('nia@example.com');
        $this->registerBusiness('juma@example.com');

        // Registering the two businesses above left BusinessContext pointing at the
        // last one (a static singleton that only real per-process request boundaries
        // reset in production); reset it so the factory's business_id:null actually
        // sticks instead of being auto-filled by BelongsToBusiness's creating hook.
        BusinessContext::set(null);
        $admin = User::factory()->create(['business_id' => null]);
        Sanctum::actingAs($admin, ['*']);

        $list = $this->getJson('/api/v1/platform/businesses')->assertOk()->json();
        $this->assertCount(2, $list['data']);

        $target = Business::where('name', 'Mama Nia Shop')->firstOrFail();
        $this->putJson("/api/v1/platform/businesses/{$target->id}/status", ['status' => 'suspended'])
            ->assertOk()
            ->assertJsonPath('status', 'suspended');

        $this->assertSame('suspended', $target->fresh()->status);

        $stats = $this->getJson('/api/v1/platform/stats')->assertOk()->json();
        $this->assertSame(2, $stats['total_businesses']);
        $this->assertSame(1, $stats['suspended_businesses']);
    }

    public function test_platform_admin_can_view_a_single_business_with_its_owner_and_reports_a_correct_staff_count(): void
    {
        [, , $business] = $this->registerBusiness();

        BusinessContext::set(null);
        $admin = User::factory()->create(['business_id' => null]);
        Sanctum::actingAs($admin, ['*']);

        // Regression check: businesses() and show() both build a subquery/relation
        // against User (business-scoped) and must run inside platform mode, or the
        // count/relation silently resolves against BusinessScope's deny-by-default and
        // reads 0/empty no matter how many staff the business actually has.
        $list = $this->getJson('/api/v1/platform/businesses')->assertOk()->json();
        $this->assertSame(1, $list['data'][0]['users_count']);

        $detail = $this->getJson("/api/v1/platform/businesses/{$business->id}")->assertOk()->json();
        $this->assertSame('Mama Nia Shop', $detail['name']);
        $this->assertSame(1, $detail['staff_count']);
        $this->assertSame('Nia Mwangi', $detail['owner']['name']);
        $this->assertSame('nia@example.com', $detail['owner']['email']);
        $this->assertArrayHasKey('branches', $detail);
    }

    public function test_platform_admin_can_soft_delete_and_restore_a_business_without_losing_its_data(): void
    {
        [, $owner, $business] = $this->registerBusiness();
        $branch = Branch::firstOrFail();

        BusinessContext::set(null);
        $admin = User::factory()->create(['business_id' => null]);
        Sanctum::actingAs($admin, ['*']);

        // A reason is mandatory for both deleting and (later) restoring.
        $this->deleteJson("/api/v1/platform/businesses/{$business->id}", [])->assertStatus(422);

        $this->deleteJson("/api/v1/platform/businesses/{$business->id}", ['reason' => 'Non-payment for 3 months'])
            ->assertOk();
        $this->assertNotNull($business->fresh()->deleted_at);
        $this->assertSame('Non-payment for 3 months', $business->fresh()->deletion_reason);

        // Drops out of the default list...
        $list = $this->getJson('/api/v1/platform/businesses')->assertOk()->json();
        $this->assertCount(0, $list['data']);

        // ...but is still visible (and its data intact) under ?trashed=1.
        $trashed = $this->getJson('/api/v1/platform/businesses?trashed=1')->assertOk()->json();
        $this->assertCount(1, $trashed['data']);
        $this->assertSame('Non-payment for 3 months', $trashed['data'][0]['deletion_reason']);
        $this->assertNotNull(BusinessContext::runAsPlatform(fn () => Branch::find($branch->id)));

        // A deleted business can no longer log in — same enforcement path as suspension.
        // (login doesn't resolve $request->user() at all, so unlike the license-expiry
        // test this needs no guard-cache reset — only calls that re-authenticate via a
        // Bearer token would be affected by that gotcha.)
        $this->postJson('/api/v1/auth/login', ['email' => $owner['email'], 'password' => 'password123'])
            ->assertStatus(422);

        // The detail view stays reachable for a deleted business too (e.g. from the
        // "Deleted businesses" tab) rather than 404ing just because it's soft-deleted.
        $detail = $this->getJson("/api/v1/platform/businesses/{$business->id}")->assertOk()->json();
        $this->assertNotNull($detail['deleted_at']);
        $this->assertSame('Non-payment for 3 months', $detail['deletion_reason']);

        $this->postJson("/api/v1/platform/businesses/{$business->id}/restore", [])->assertStatus(422);

        $this->postJson("/api/v1/platform/businesses/{$business->id}/restore", ['reason' => 'Paid outstanding balance'])
            ->assertOk();
        $this->assertNull($business->fresh()->deleted_at);
        $this->assertNull($business->fresh()->deletion_reason);

        $this->postJson('/api/v1/auth/login', ['email' => $owner['email'], 'password' => 'password123'])->assertOk();
    }

    public function test_platform_admin_is_notified_when_a_new_business_registers(): void
    {
        $this->postJson('/api/v1/auth/register', [
            'business_name' => 'Neema Bakery',
            'business_category' => 'Bakery',
            'owner_name' => 'Neema Test',
            'email' => 'neema@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])->assertCreated();

        BusinessContext::set(null);
        $admin = User::factory()->create(['business_id' => null]);
        Sanctum::actingAs($admin, ['*']);

        $notifications = $this->getJson('/api/v1/platform/notifications')->assertOk()->json();
        $this->assertCount(1, $notifications);
        $this->assertSame('business_registered', $notifications[0]['type']);
        $this->assertStringContainsString('Neema Bakery', $notifications[0]['message']);
        $this->assertStringContainsString('Bakery', $notifications[0]['message']);
        $this->assertNull($notifications[0]['read_at']);

        $this->postJson("/api/v1/platform/notifications/{$notifications[0]['id']}/read")->assertOk();
        $unread = $this->getJson('/api/v1/platform/notifications?unread_only=1')->assertOk()->json();
        $this->assertCount(0, $unread);
    }
}
