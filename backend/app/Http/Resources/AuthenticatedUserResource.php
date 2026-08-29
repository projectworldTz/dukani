<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * The user + role/permission/business payload the frontend needs to bootstrap its
 * Zustand auth store right after login/register, without a second round-trip.
 * Requires BusinessContext to already be set to this user's business (see
 * AuthController) so roles()/getAllPermissions() resolve the correct team-scoped rows.
 */
class AuthenticatedUserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'email_verified_at' => $this->email_verified_at,
            'phone' => $this->phone,
            'status' => $this->status,
            'is_platform_admin' => $this->isPlatformAdmin(),
            'branch_id' => $this->staffProfile?->branch_id,
            'job_title' => $this->staffProfile?->job_title,
            'roles' => $this->getRoleNames(),
            'permissions' => $this->getAllPermissions()->pluck('name'),
            'business' => $this->whenLoaded('business', fn () => [
                'id' => $this->business->id,
                'name' => $this->business->name,
                'slug' => $this->business->slug,
                'currency' => $this->business->currency,
                'timezone' => $this->business->timezone,
            ]),
        ];
    }
}
