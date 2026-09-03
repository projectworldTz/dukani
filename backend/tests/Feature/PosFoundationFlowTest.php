<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Business;
use App\Models\Product;
use App\Models\Sale;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Exercises the Phase 1 spine end to end: business registration seeds RBAC, a single
 * "Seller" user can hold Manager+Cashier+Storekeeper simultaneously (the spec's
 * explicit final-requirement scenario), the Business Owner role is protected, barcode
 * duplicates are rejected, and a full sale decrements stock / issues a unique receipt
 * number / generates a working receipt + verification payload.
 *
 * Uses Sanctum::actingAs() (not a real Bearer token + withToken()) whenever a test
 * needs to switch actors mid-test: Sanctum's RequestGuard caches the first resolved
 * user for the guard's lifetime, and Laravel's test client reuses one application
 * instance across every simulated call in a test method, so a second withToken() call
 * with a different user's token would silently keep authenticating as the first user.
 * actingAs() sets the guard's user directly, sidestepping that entirely.
 */
class PosFoundationFlowTest extends TestCase
{
    use RefreshDatabase;

    private function registerBusiness(): array
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'business_name' => 'Mama Nia Shop',
            'owner_name' => 'Nia Mwangi',
            'email' => 'nia@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])->assertCreated();

        return [$response->json('token'), $response->json('user'), Business::firstOrFail()];
    }

    public function test_registration_seeds_default_roles_and_owner_gets_full_access(): void
    {
        [$token, $user] = $this->registerBusiness();

        $this->assertContains('Business Owner', $user['roles']);
        $this->assertContains('staff.manage', $user['permissions']);
        $this->assertContains('sales.create', $user['permissions']);

        $this->withToken($token)->getJson('/api/v1/auth/me')->assertOk();
    }

    public function test_single_user_can_hold_manager_cashier_and_storekeeper_roles_at_once(): void
    {
        [$ownerToken] = $this->registerBusiness();
        $branchId = Branch::firstOrFail()->id;
        $otherBranchId = $this->withToken($ownerToken)->postJson('/api/v1/branches', [
            'name' => 'Other Branch', 'code' => 'OTHER',
        ])->assertCreated()->json('id');

        $response = $this->withToken($ownerToken)->postJson('/api/v1/staff', [
            'name' => 'Seller',
            'email' => 'seller@example.com',
            'branch_id' => $branchId,
            'job_title' => 'Seller',
            'password' => 'password123',
            'roles' => ['Manager', 'Cashier', 'Storekeeper'],
        ])->assertCreated();

        // ->additional() (used here to also return the generated password) re-wraps
        // the resource under "data" even though JsonResource::withoutWrapping() is on
        // globally — that toggle only applies to plain, un-additional'd resources.
        $this->assertEqualsCanonicalizing(['Manager', 'Cashier', 'Storekeeper'], $response->json('data.roles'));

        $seller = User::where('email', 'seller@example.com')->firstOrFail();
        Sanctum::actingAs($seller, ['*']);

        // Can manage products (Storekeeper) ...
        $this->postJson('/api/v1/products', [
            'name' => 'Bag of Rice 25kg', 'cost_price' => 40000, 'selling_price' => 50000,
        ])->assertCreated();

        // ... and open a shift + ring up a sale (Cashier), all as one account.
        $this->postJson('/api/v1/shifts/open', [
            'branch_id' => $otherBranchId, 'opening_cash' => 10000,
        ])->assertUnprocessable();

        $this->postJson('/api/v1/shifts/open', [
            'branch_id' => $branchId, 'opening_cash' => 10000,
        ])->assertCreated();
    }

    public function test_only_a_business_owner_can_grant_the_business_owner_role(): void
    {
        [$ownerToken] = $this->registerBusiness();
        $branchId = Branch::firstOrFail()->id;

        $this->withToken($ownerToken)->postJson('/api/v1/staff', [
            'name' => 'Manager Mo', 'email' => 'mo@example.com', 'branch_id' => $branchId,
            'password' => 'password123', 'roles' => ['Manager'],
        ])->assertCreated();

        // The Business Owner customizes the Manager role to also allow staff.manage
        // (spec: "Manager should not automatically have staff access; the Business
        // Owner decides") — so this Manager CAN reach staff creation at all, isolating
        // the assertion below to the Business-Owner-role-specific protection, not a
        // generic staff.manage permission gate.
        $roles = collect($this->withToken($ownerToken)->getJson('/api/v1/roles')->json());
        $managerRole = $roles->firstWhere('name', 'Manager');
        $this->withToken($ownerToken)->putJson("/api/v1/roles/{$managerRole['id']}/permissions", [
            'permissions' => [...$managerRole['permissions'], 'staff.manage'],
        ])->assertOk();

        $manager = User::where('email', 'mo@example.com')->firstOrFail();
        Sanctum::actingAs($manager, ['*']);

        // A Manager (not a Business Owner, but now WITH staff.manage) tries to promote
        // a new hire to Business Owner — rejected by the role-protection rule itself,
        // not by lacking staff.manage.
        $this->postJson('/api/v1/staff', [
            'name' => 'Sneaky', 'email' => 'sneaky@example.com', 'branch_id' => $branchId,
            'password' => 'password123', 'roles' => ['Business Owner'],
        ])->assertStatus(422);
    }

    public function test_duplicate_barcode_assignment_is_rejected(): void
    {
        [$ownerToken] = $this->registerBusiness();

        $productA = $this->withToken($ownerToken)->postJson('/api/v1/products', [
            'name' => 'Soap', 'cost_price' => 500, 'selling_price' => 800,
        ])->json();
        $productB = $this->withToken($ownerToken)->postJson('/api/v1/products', [
            'name' => 'Sugar 1kg', 'cost_price' => 2000, 'selling_price' => 2500,
        ])->json();

        $this->withToken($ownerToken)->postJson("/api/v1/products/{$productA['id']}/barcodes/assign", [
            'code' => '6009123456789', 'type' => 'EAN13', 'primary' => true,
        ])->assertCreated();

        $this->withToken($ownerToken)->postJson("/api/v1/products/{$productB['id']}/barcodes/assign", [
            'code' => '6009123456789', 'type' => 'EAN13', 'primary' => true,
        ])->assertStatus(422);
    }

    public function test_scanner_accepts_hardware_prefixes_and_returns_branch_stock(): void
    {
        [$ownerToken] = $this->registerBusiness();
        $branch = Branch::firstOrFail();

        $product = $this->withToken($ownerToken)->postJson('/api/v1/products', [
            'name' => 'Scanned Soap', 'cost_price' => 500, 'selling_price' => 800,
        ])->assertCreated()->json();

        $this->withToken($ownerToken)->postJson("/api/v1/products/{$product['id']}/barcodes/assign", [
            'code' => '6009123456789', 'type' => 'EAN13', 'primary' => true,
        ])->assertCreated();

        $this->withToken($ownerToken)->postJson("/api/v1/products/{$product['id']}/stock/adjust", [
            'branch_id' => $branch->id, 'quantity_change' => 7, 'type' => 'opening_stock',
        ])->assertCreated();

        $this->withToken($ownerToken)->postJson('/api/v1/pos/scan', [
            'code' => "]C1 6009123456789\r\n",
            'branch_id' => $branch->id,
        ])->assertOk()
            ->assertJsonPath('id', $product['id'])
            ->assertJsonPath('available_stock', 7);
    }

    public function test_full_sale_decrements_stock_and_issues_unique_receipt(): void
    {
        [$ownerToken] = $this->registerBusiness();
        $branch = Branch::firstOrFail();

        $product = $this->withToken($ownerToken)->postJson('/api/v1/products', [
            'name' => 'Cooking Oil 5L', 'cost_price' => 15000, 'selling_price' => 20000, 'tax_rate' => 18,
        ])->json();

        $this->withToken($ownerToken)->postJson("/api/v1/products/{$product['id']}/stock/adjust", [
            'branch_id' => $branch->id, 'quantity_change' => 10, 'type' => 'opening_stock',
        ])->assertCreated();

        $catalogProduct = $this->withToken($ownerToken)
            ->getJson("/api/v1/products?branch_id={$branch->id}&search=Cooking%20Oil")
            ->assertOk()
            ->json('data.0');
        $this->assertSame(10, $catalogProduct['available_stock']);

        $shift = $this->withToken($ownerToken)->postJson('/api/v1/shifts/open', [
            'branch_id' => $branch->id, 'opening_cash' => 50000,
        ])->assertCreated()->json();

        $methods = $this->withToken($ownerToken)->getJson('/api/v1/payment-methods')->json();
        $cashMethodId = collect($methods)->firstWhere('type', 'cash')['id'];

        // 2 x 20000 = 40000 subtotal, 18% tax exclusive = 7200 tax -> 47200 due. Pay
        // 50000 cash to also exercise change calculation.
        $sale = $this->withToken($ownerToken)->postJson('/api/v1/sales', [
            'branch_id' => $branch->id,
            'shift_id' => $shift['id'],
            'items' => [['product_id' => $product['id'], 'quantity' => 2]],
            'payments' => [['payment_method_id' => $cashMethodId, 'amount' => 50000]],
        ])->assertCreated()->json();

        $this->assertSame('completed', $sale['status']);
        $this->assertMatchesRegularExpression('/^MAIN-POS-\d{4}-000001$/', $sale['receipt_number']);
        $this->assertEquals(47200, $sale['grand_total']);
        $this->assertEquals(2800, $sale['change_amount']);

        // Browser-supplied prices are ignored; the server remains authoritative.
        $serverPricedSale = $this->withToken($ownerToken)->postJson('/api/v1/sales', [
            'branch_id' => $branch->id,
            'shift_id' => $shift['id'],
            'items' => [['product_id' => $product['id'], 'quantity' => 1, 'unit_price' => 1]],
            'payments' => [['payment_method_id' => $cashMethodId, 'amount' => 23600]],
        ])->assertCreated()->json();
        $this->assertEquals(23600, $serverPricedSale['grand_total']);

        $this->withToken($ownerToken)->postJson('/api/v1/sales', [
            'branch_id' => $branch->id,
            'shift_id' => $shift['id'],
            'items' => [['product_id' => $product['id'], 'quantity' => 1, 'discount_amount' => 25000]],
            'payments' => [['payment_method_id' => $cashMethodId, 'amount' => 1]],
        ])->assertUnprocessable();

        $mobileMethodId = collect($methods)->firstWhere('type', 'mobile_money')['id'];
        $this->withToken($ownerToken)->postJson('/api/v1/sales', [
            'branch_id' => $branch->id,
            'shift_id' => $shift['id'],
            'items' => [['product_id' => $product['id'], 'quantity' => 1]],
            'payments' => [['payment_method_id' => $mobileMethodId, 'amount' => 25000]],
        ])->assertUnprocessable();

        $product = Product::find($product['id']);
        $this->assertSame(7, $product->inventories()->where('branch_id', $branch->id)->value('quantity'));

        // Insufficient stock is rejected cleanly, not silently allowed negative.
        $this->withToken($ownerToken)->postJson('/api/v1/sales', [
            'branch_id' => $branch->id,
            'shift_id' => $shift['id'],
            'items' => [['product_id' => $product->id, 'quantity' => 999]],
            'payments' => [['payment_method_id' => $cashMethodId, 'amount' => 999999]],
        ])->assertStatus(422);

        // Receipt PDF renders and the public verify endpoint resolves it without auth.
        $this->withToken($ownerToken)->get("/api/v1/sales/{$sale['id']}/receipt.pdf")
            ->assertOk()->assertHeader('content-type', 'application/pdf');

        $token = Sale::findOrFail($sale['id'])->receipt_verification_token;
        $verify = $this->getJson('/api/v1/receipts/verify/'.$token)->assertOk();
        $verify->assertJsonPath('receipt_number', $sale['receipt_number']);
    }
}
