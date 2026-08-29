<?php

namespace App\Services\Products;

use App\Models\Barcode;
use App\Models\Business;
use App\Models\Product;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Internally generated barcodes: PRD000001, PRD000002, ... per business (spec §5),
 * Code128-encoded. Manufacturer barcodes are entered/scanned directly via
 * `assignManual()` instead — both paths land in the same `barcodes` table, whose
 * business-scoped unique constraint on `code` is what actually prevents duplicate
 * barcode assignment (this service doesn't re-check uniqueness itself, the DB does).
 */
class BarcodeSequenceService
{
    public function generateInternal(Product $product, Business $business, bool $primary = false): Barcode
    {
        return DB::transaction(function () use ($product, $business, $primary) {
            $count = Barcode::where('business_id', $business->id)
                ->where('type', 'INTERNAL')
                ->lockForUpdate()
                ->count();

            $code = 'PRD'.str_pad((string) ($count + 1), 6, '0', STR_PAD_LEFT);

            return $this->assign($product, $business, $code, 'INTERNAL', $primary);
        });
    }

    public function assignManual(Product $product, Business $business, string $code, string $type, bool $primary = false): Barcode
    {
        return $this->assign($product, $business, $code, $type, $primary);
    }

    private function assign(Product $product, Business $business, string $code, string $type, bool $primary): Barcode
    {
        if (Barcode::where('business_id', $business->id)->where('code', $code)->exists()) {
            throw ValidationException::withMessages([
                'code' => 'This barcode is already assigned to another product.',
            ]);
        }

        if ($primary) {
            Barcode::where('product_id', $product->id)->update(['is_primary' => false]);
        }

        return Barcode::create([
            'business_id' => $business->id,
            'product_id' => $product->id,
            'code' => $code,
            'type' => $type,
            'is_primary' => $primary,
        ]);
    }
}
