<?php

namespace App\Http\Controllers\Api\V1\Branches;

use App\Http\Controllers\Controller;
use App\Http\Requests\Branches\StoreBranchRequest;
use App\Http\Requests\Branches\UpdateBranchRequest;
use App\Models\Branch;
use App\Support\Tenancy\BusinessContext;

class BranchController extends Controller
{
    public function index()
    {
        return Branch::orderBy('name')->get();
    }

    public function store(StoreBranchRequest $request)
    {
        $branch = Branch::create([
            ...$request->validated(),
            'business_id' => BusinessContext::id(),
            'status' => 'active',
        ]);

        return response()->json($branch, 201);
    }

    public function show(Branch $branch)
    {
        return $branch;
    }

    public function update(UpdateBranchRequest $request, Branch $branch)
    {
        $branch->update($request->validated());

        return $branch;
    }
}
