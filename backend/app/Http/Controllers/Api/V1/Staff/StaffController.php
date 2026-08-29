<?php

namespace App\Http\Controllers\Api\V1\Staff;

use App\Http\Controllers\Controller;
use App\Http\Requests\Staff\StoreStaffRequest;
use App\Http\Requests\Staff\UpdateStaffRequest;
use App\Http\Resources\StaffResource;
use App\Models\User;
use App\Services\Staff\StaffService;
use Illuminate\Http\Request;

class StaffController extends Controller
{
    public function __construct(private StaffService $staffService) {}

    public function index(Request $request)
    {
        abort_unless($request->user()->can('staff.manage'), 403);

        $staff = User::with('staffProfile')
            ->whereHas('staffProfile')
            ->orderBy('name')
            ->paginate($request->integer('per_page', 20));

        return StaffResource::collection($staff);
    }

    public function store(StoreStaffRequest $request)
    {
        [$user, $generatedPassword] = $this->staffService->create($request->validated(), $request->user());

        return (new StaffResource($user))
            ->additional(['generated_password' => $generatedPassword])
            ->response()
            ->setStatusCode(201);
    }

    public function show(Request $request, User $user)
    {
        abort_unless($request->user()->can('staff.manage'), 403);

        return new StaffResource($user->load('staffProfile'));
    }

    public function update(UpdateStaffRequest $request, User $user)
    {
        $updated = $this->staffService->update($user, $request->validated(), $request->user());

        return new StaffResource($updated);
    }
}
