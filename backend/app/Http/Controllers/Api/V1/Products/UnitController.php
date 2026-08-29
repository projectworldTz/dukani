<?php

namespace App\Http\Controllers\Api\V1\Products;

use App\Http\Controllers\Controller;
use App\Models\Unit;
use App\Support\Tenancy\BusinessContext;
use Illuminate\Http\Request;

class UnitController extends Controller
{
    public function index()
    {
        return Unit::orderBy('name')->get();
    }

    public function store(Request $request)
    {
        abort_unless($request->user()->can('products.manage'), 403);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'short_name' => ['required', 'string', 'max:10'],
        ]);
        $unit = Unit::create([...$data, 'business_id' => BusinessContext::id()]);

        return response()->json($unit, 201);
    }

    public function update(Request $request, Unit $unit)
    {
        abort_unless($request->user()->can('products.manage'), 403);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'short_name' => ['sometimes', 'string', 'max:10'],
        ]);
        $unit->update($data);

        return $unit;
    }

    public function destroy(Request $request, Unit $unit)
    {
        abort_unless($request->user()->can('products.manage'), 403);
        $unit->delete();

        return response()->json(null, 204);
    }
}
