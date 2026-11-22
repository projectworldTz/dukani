<?php

namespace App\Services\Business;

use App\Models\Branch;
use App\Models\Business;
use App\Models\BusinessSetting;
use App\Models\PaymentMethod;
use App\Models\PlatformNotification;
use App\Models\ProductCategory;
use App\Support\Pharmacy\PharmacyCatalog;
use App\Models\StaffProfile;
use App\Models\User;
use App\Services\Rbac\RolePermissionSeederService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Registers a brand-new business: Business + Business Owner user + a default Branch +
 * default RBAC roles/permissions (see RolePermissionSeederService) + starter payment
 * methods, all inside one DB transaction — either the whole thing lands, or none of it
 * does.
 */
class BusinessRegistrationService
{
    public function __construct(private RolePermissionSeederService $roleSeeder) {}

    public function register(array $data): array
    {
        return DB::transaction(function () use ($data) {
            $business = Business::create([
                'name' => $data['business_name'],
                'category' => $data['business_category'] ?? null,
                'slug' => $this->uniqueSlug($data['business_name']),
                'currency' => $data['currency'] ?? 'TZS',
                'timezone' => $data['timezone'] ?? 'Africa/Dar_es_Salaam',
                'status' => 'active',
            ]);

            $owner = User::create([
                'business_id' => $business->id,
                'name' => $data['owner_name'],
                'email' => $data['email'],
                'phone' => $data['phone'] ?? null,
                'password' => $data['password'],
                'status' => 'active',
            ]);

            $business->update(['owner_user_id' => $owner->id]);

            $branch = Branch::create([
                'business_id' => $business->id,
                'name' => 'Main Branch',
                'code' => 'MAIN',
                'is_main' => true,
                'status' => 'active',
            ]);

            StaffProfile::create([
                'business_id' => $business->id,
                'user_id' => $owner->id,
                'branch_id' => $branch->id,
                'job_title' => 'Business Owner',
            ]);

            BusinessSetting::create(['business_id' => $business->id]);

            $this->roleSeeder->seedDefaultRolesFor($business);
            $owner->assignRole('Business Owner');

            foreach ([
                ['name' => 'Cash', 'type' => 'cash'],
                ['name' => 'Mobile Money', 'type' => 'mobile_money'],
                ['name' => 'Bank Transfer', 'type' => 'bank_transfer'],
                ['name' => 'Card', 'type' => 'card'],
            ] as $method) {
                PaymentMethod::create([
                    'business_id' => $business->id,
                    'name' => $method['name'],
                    'type' => $method['type'],
                ]);
            }

            $starter = PharmacyCatalog::isPharmacy($business)
                ? PharmacyCatalog::STARTER_CATEGORIES
                : (\App\Support\Butchery\ButcheryCatalog::isButchery($business) ? \App\Support\Butchery\ButcheryCatalog::STARTER_CATEGORIES : []);
            if ($starter) {
                foreach ($starter as $name) {
                    ProductCategory::create(['business_id' => $business->id, 'name' => $name]);
                }
            }

            PlatformNotification::create([
                'type' => 'business_registered',
                'title' => 'New business registered',
                'message' => trim("{$business->name}".($business->category ? " ({$business->category})" : '')." just signed up, owned by {$owner->name} <{$owner->email}>."),
                'business_id' => $business->id,
            ]);

            return [$business, $owner, $branch];
        });
    }

    private function uniqueSlug(string $name): string
    {
        $base = Str::slug($name);
        $slug = $base;
        $suffix = 1;

        while (Business::where('slug', $slug)->exists()) {
            $slug = $base.'-'.(++$suffix);
        }

        return $slug;
    }
}
