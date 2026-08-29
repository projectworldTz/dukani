<?php

namespace App\Http\Controllers\Api\V1\Products;

use App\Http\Controllers\Controller;
use App\Models\Brand;
use App\Support\Tenancy\BusinessContext;
use Illuminate\Http\Request;

class BrandController extends Controller
{
    public function index()
    {
        return Brand::orderBy('name')->get();
    }

    public function store(Request $request)
    {
        abort_unless($request->user()->can('products.manage'), 403);

        $data = $request->validate(['name' => ['required', 'string', 'max:255']]);
        $brand = Brand::create([...$data, 'business_id' => BusinessContext::id()]);

        return response()->json($brand, 201);
    }

    public function update(Request $request, Brand $brand)
    {
        abort_unless($request->user()->can('products.manage'), 403);

        $data = $request->validate(['name' => ['required', 'string', 'max:255']]);
        $brand->update($data);

        return $brand;
    }

    public function destroy(Request $request, Brand $brand)
    {
        abort_unless($request->user()->can('products.manage'), 403);
        $brand->delete();

        return response()->json(null, 204);
    }
}
