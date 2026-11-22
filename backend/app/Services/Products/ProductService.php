<?php

namespace App\Services\Products;

use App\Models\Branch;
use App\Models\Product;
use App\Models\User;
use App\Services\Inventory\StockMovementService;
use App\Services\Pharmacy\PharmacyStockService;
use App\Support\Tenancy\BusinessContext;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Intervention\Image\Laravel\Facades\Image;

class ProductService
{
    public function __construct(
        private BarcodeSequenceService $barcodeSequenceService,
        private StockMovementService $stockMovementService,
        private PharmacyStockService $pharmacyStockService,
    ) {}

    public function create(array $data, User $creator, ?UploadedFile $image = null): Product
    {
        return DB::transaction(function () use ($data, $creator, $image) {
            $isPharmacy = $creator->business->isPharmacy();
            $product = Product::create([
                ...$this->fillable($data),
                // Every medicine is tracked by batch and expiry on the pharmacy platform.
                ...($isPharmacy ? ['has_batch' => true, 'has_expiry' => true] : []),
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

            $openingStock = (int) ($data['opening_stock'] ?? 0);
            if ($openingStock > 0) {
                $branchId = $data['branch_id']
                    ?? $creator->staffProfile?->branch_id
                    ?? Branch::orderByDesc('is_main')->orderBy('id')->value('id');

                if ($branchId && $isPharmacy) {
                    $this->pharmacyStockService->receive(
                        $product, (int) $branchId, $openingStock, trim($data['opening_batch_number']), $data['opening_expiry_date'],
                        'opening_stock', 'Opening stock', $creator->id,
                    );
                } elseif ($branchId) {
                    $this->stockMovementService->adjust(
                        product: $product,
                        branchId: (int) $branchId,
                        quantityChange: $openingStock,
                        type: 'opening_stock',
                        reason: 'Opening stock',
                        userId: $creator->id,
                    );
                }
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
            'generic_name', 'strength', 'dosage_form', 'pack_size', 'manufacturer', 'requires_prescription', 'is_controlled',
            'sold_by_weight',
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
