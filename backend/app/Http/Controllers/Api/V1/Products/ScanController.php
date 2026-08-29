<?php

namespace App\Http\Controllers\Api\V1\Products;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductResource;
use App\Models\Barcode;
use App\Models\Product;
use Illuminate\Http\Request;

/**
 * Unified lookup for the POS checkout screen (spec §6/§7): a USB/Bluetooth scanner
 * types a barcode followed by Enter (keyboard-wedge, no special API needed on the
 * frontend), a camera/QR scan yields a `dukani:product:{uuid}` payload. Either way
 * this single endpoint resolves it to a product ready to add to the cart.
 */
class ScanController extends Controller
{
    public function __invoke(Request $request)
    {
        $request->validate(['code' => ['required', 'string']]);
        $code = $request->string('code')->toString();

        if (str_starts_with($code, 'dukani:product:')) {
            $uuid = substr($code, strlen('dukani:product:'));
            $product = Product::where('uuid', $uuid)->first();
        } else {
            $product = Barcode::where('code', $code)->first()?->product;
        }

        if (! $product || $product->status !== 'active') {
            return response()->json(['message' => 'Product not found.'], 404);
        }

        return new ProductResource($product->load(['category', 'brand', 'unit', 'barcodes']));
    }
}
