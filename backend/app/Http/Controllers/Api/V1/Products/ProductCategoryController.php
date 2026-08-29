<?php

namespace App\Http\Controllers\Api\V1\Products;

use App\Http\Controllers\Controller;
use App\Models\ProductCategory;
use App\Support\Tenancy\BusinessContext;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ProductCategoryController extends Controller
{
    public function index()
    {
        return ProductCategory::orderBy('name')->get();
    }

    public function store(Request $request)
    {
        abort_unless($request->user()->can('products.manage'), 403);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'parent_id' => ['nullable', 'integer', Rule::exists('product_categories', 'id')->where('business_id', BusinessContext::id())],
        ]);

        $category = ProductCategory::create([...$data, 'business_id' => BusinessContext::id()]);

        return response()->json($category, 201);
    }

    public function update(Request $request, ProductCategory $productCategory)
    {
        abort_unless($request->user()->can('products.manage'), 403);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'parent_id' => ['sometimes', 'nullable', 'integer', Rule::exists('product_categories', 'id')->where('business_id', BusinessContext::id())],
        ]);

        $productCategory->update($data);

        return $productCategory;
    }

    public function destroy(Request $request, ProductCategory $productCategory)
    {
        abort_unless($request->user()->can('products.manage'), 403);

        $productCategory->delete();

        return response()->json(null, 204);
    }
}
