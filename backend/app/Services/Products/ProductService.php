<?php

namespace App\Services\Products;

use App\Models\Product;
use App\Models\User;
use App\Support\Tenancy\BusinessContext;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Intervention\Image\Laravel\Facades\Image;

class ProductService
{
    public function __construct(private BarcodeSequenceService $barcodeSequenceService) {}

    public function create(array $data, User $creator, ?UploadedFile $image = null): Product
    {
        return DB::transaction(function () use ($data, $creator, $image) {
            $product = Product::create([
                ...$this->fillable($data),
                'business_id' => BusinessContext::id(),
                'created_by' => $creator->id,
            ]);

            if ($image) {
                $product->update(['image_path' => $this->storeImage($image, $product)]);
            }

            if (! empty($data['barcode'])) {
                $this->barcodeSequenceService->assignManual(
                    $product, $creator->business, $data['barcode'], $data['barcode_type'] ?? 'CODE128', true,
                );
            } elseif (! empty($data['generate_barcode'])) {
                $this->barcodeSequenceService->generateInternal($product, $creator->business, true);
            }

            return $product->load('barcodes', 'category', 'brand', 'unit');
        });
    }

    public function update(Product $product, array $data, ?UploadedFile $image = null): Product
    {
        return DB::transaction(function () use ($product, $data, $image) {
            $product->update($this->fillable($data));

            if ($image) {
                $product->update(['image_path' => $this->storeImage($image, $product)]);
            }

            return $product->load('barcodes', 'category', 'brand', 'unit');
        });
    }

    private function fillable(array $data): array
    {
        return array_intersect_key($data, array_flip([
            'category_id', 'brand_id', 'unit_id', 'supplier_id',
            'name', 'description', 'sku',
            'cost_price', 'selling_price', 'wholesale_price', 'minimum_selling_price',
            'tax_rate', 'is_tax_inclusive', 'discount_percent',
            'reorder_level', 'max_stock_level', 'shelf_location',
            'has_expiry', 'has_batch', 'has_serial', 'status',
        ]));
    }

    private function storeImage(UploadedFile $image, Product $product): string
    {
        $path = "products/{$product->business_id}/".Str::uuid().'.webp';
        $encoded = Image::read($image)->scaleDown(width: 800)->toWebp(80);

        Storage::disk('public')->put($path, (string) $encoded);

        return $path;
    }
}
