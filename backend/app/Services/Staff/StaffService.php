<?php

namespace App\Services\Staff;

use App\Models\StaffProfile;
use App\Models\User;
use App\Services\Rbac\RoleService;
use App\Support\Tenancy\BusinessContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class StaffService
{
    public function __construct(private RoleService $roleService) {}

    /**
     * Creates a staff User + StaffProfile + role assignment in one transaction. When no
     * password is supplied, a random one is generated and returned once (uncollapsed)
     * in the result — there's no email/SMS provider wired up yet to deliver it, the
     * same gap sibling projects document for their own no-provider-configured flows.
     */
    public function create(array $data, User $actor): array
    {
        return DB::transaction(function () use ($data, $actor) {
            $generatedPassword = null;
            $password = $data['password'] ?? null;

            if (! $password) {
                $generatedPassword = Str::password(12);
                $password = $generatedPassword;
            }

            $user = User::create([
                'business_id' => BusinessContext::id(),
                'name' => $data['name'],
                'email' => $data['email'],
                'phone' => $data['phone'] ?? null,
                'password' => $password,
                'status' => $data['status'] ?? 'active',
            ]);

            StaffProfile::create([
                'business_id' => BusinessContext::id(),
                'user_id' => $user->id,
                'branch_id' => $data['branch_id'] ?? null,
                'job_title' => $data['job_title'] ?? null,
            ]);

            $this->roleService->syncRoles($user, $data['roles'] ?? [], $actor);

            return [$user->load('staffProfile'), $generatedPassword];
        });
    }

    public function update(User $user, array $data, User $actor): User
    {
        return DB::transaction(function () use ($user, $data, $actor) {
            $user->fill(array_filter([
                'name' => $data['name'] ?? null,
                'phone' => $data['phone'] ?? null,
                'status' => $data['status'] ?? null,
            ], fn ($v) => $v !== null))->save();

            if (array_key_exists('branch_id', $data) || array_key_exists('job_title', $data)) {
                $user->staffProfile()->updateOrCreate(
                    ['user_id' => $user->id],
                    array_filter([
                        'branch_id' => $data['branch_id'] ?? $user->staffProfile?->branch_id,
                        'job_title' => $data['job_title'] ?? $user->staffProfile?->job_title,
                    ], fn ($v) => $v !== null)
                );
            }

            if (array_key_exists('roles', $data)) {
                $this->roleService->syncRoles($user, $data['roles'], $actor);
            }

            return $user->load('staffProfile');
        });
    }
}
