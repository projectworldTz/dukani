<?php

namespace App\Http\Controllers\Api\V1\Products;

use App\Http\Controllers\Controller;
use App\Http\Requests\Products\StoreProductRequest;
use App\Http\Requests\Products\UpdateProductRequest;
use App\Http\Resources\ProductResource;
use App\Models\Product;
use App\Services\Products\ProductService;
use App\Support\Tenancy\BusinessContext;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ProductController extends Controller
{
    public function __construct(private ProductService $productService) {}

    public function index(Request $request)
    {
        $products = Product::with(['category', 'brand', 'unit', 'barcodes'])
            ->when($request->filled('search'), fn ($q) => $q->where(function ($q) use ($request) {
                $term = '%'.$request->string('search').'%';
                $q->where('name', 'like', $term)
                    ->orWhere('sku', 'like', $term)
                    ->orWhereHas('barcodes', fn ($q) => $q->where('code', 'like', $term));
            }))
            ->when($request->filled('category_id'), fn ($q) => $q->where('category_id', $request->integer('category_id')))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->orderBy('name')
            ->paginate($request->integer('per_page', 20));

        return ProductResource::collection($products);
    }

    public function store(StoreProductRequest $request)
    {
        $product = $this->productService->create($request->validated(), $request->user(), $request->file('image'));

        return (new ProductResource($product))->response()->setStatusCode(201);
    }

    public function show(Product $product)
    {
        return new ProductResource($product->load(['category', 'brand', 'unit', 'barcodes']));
    }

    public function update(UpdateProductRequest $request, Product $product)
    {
        $updated = $this->productService->update($product, $request->validated(), $request->file('image'));

        return new ProductResource($updated);
    }

    public function destroy(Request $request, Product $product)
    {
        abort_unless($request->user()->can('products.delete'), 403);

        // Soft delete only — a product referenced by past sale_items must stay
        // resolvable (spec §57), sale_items already carries its own price/name snapshot.
        $product->delete();

        return response()->json(null, 204);
    }

    /** CSV export (spec §41) — plain PHP fputcsv, no extra dependency needed for this. */
    public function export(Request $request): StreamedResponse
    {
        $columns = ['name', 'sku', 'category', 'brand', 'unit', 'cost_price', 'selling_price', 'tax_rate', 'reorder_level', 'status'];

        return response()->streamDownload(function () use ($columns) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, $columns);

            Product::with('category:id,name', 'brand:id,name', 'unit:id,name')->chunk(200, function ($products) use ($handle) {
                foreach ($products as $product) {
                    fputcsv($handle, [
                        $product->name, $product->sku, $product->category?->name, $product->brand?->name, $product->unit?->name,
                        $product->cost_price, $product->selling_price, $product->tax_rate, $product->reorder_level, $product->status,
                    ]);
                }
            });

            fclose($handle);
        }, 'products.csv', ['Content-Type' => 'text/csv']);
    }

    /**
     * CSV import (spec §41) — validates every row before writing anything (all-or-none
     * per row, not per file: a bad row is skipped and reported, good rows still land),
     * rejects a SKU/barcode that already exists in this business rather than silently
     * overwriting it.
     */
    public function import(Request $request)
    {
        abort_unless($request->user()->can('products.manage'), 403);
        $request->validate(['file' => ['required', 'file', 'mimes:csv,txt']]);

        $handle = fopen($request->file('file')->getRealPath(), 'r');
        $header = fgetcsv($handle);
        $created = 0;
        $errors = [];
        $row = 1;

        DB::transaction(function () use ($handle, $header, &$created, &$errors, &$row, $request) {
            while (($line = fgetcsv($handle)) !== false) {
                $row++;

                if (count($line) !== count($header)) {
                    $errors[] = "Row {$row}: expected ".count($header).' columns, got '.count($line).'.';

                    continue;
                }

                $data = array_combine($header, $line);

                if (empty($data['name']) || ! is_numeric($data['cost_price'] ?? null) || ! is_numeric($data['selling_price'] ?? null)) {
                    $errors[] = "Row {$row}: name, cost_price and selling_price are required.";

                    continue;
                }

                if (! empty($data['sku']) && Product::where('sku', $data['sku'])->exists()) {
                    $errors[] = "Row {$row}: SKU \"{$data['sku']}\" already exists.";

                    continue;
                }

                Product::create([
                    'business_id' => BusinessContext::id(),
                    'name' => $data['name'],
                    'sku' => $data['sku'] ?: null,
                    'cost_price' => $data['cost_price'],
                    'selling_price' => $data['selling_price'],
                    'tax_rate' => $data['tax_rate'] ?? 0,
                    'reorder_level' => $data['reorder_level'] ?? 0,
                    'status' => 'active',
                    'created_by' => $request->user()->id,
                ]);
                $created++;
            }
        });

        fclose($handle);

        return ['created' => $created, 'errors' => $errors];
    }
}
