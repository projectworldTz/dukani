<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class StaffResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'status' => $this->status,
            'branch_id' => $this->staffProfile?->branch_id,
            'job_title' => $this->staffProfile?->job_title,
            'roles' => $this->getRoleNames(),
            'created_at' => $this->created_at,
        ];
    }
}
