<?php

namespace App\Http\Controllers\Api\V1\Products;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductResource;
use App\Models\Barcode;
use App\Models\Product;
use App\Support\Tenancy\BusinessContext;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

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
        $request->validate([
            'code' => ['required', 'string', 'max:512'],
            'branch_id' => ['nullable', 'integer', Rule::exists('branches', 'id')->where('business_id', BusinessContext::id())],
        ]);
        $code = $this->normalizeCode($request->string('code')->toString());

        if ($code === '') {
            return response()->json(['message' => 'The scanned code is empty or invalid.'], 422);
        }

        if (str_starts_with($code, 'dukani:product:')) {
            $uuid = substr($code, strlen('dukani:product:'));
            $product = Product::where('uuid', $uuid)->first();
        } else {
            $product = Barcode::where('code', $code)->first()?->product;
        }

        if (! $product || $product->status !== 'active') {
            return response()->json(['message' => 'Product not found.'], 404);
        }

        if ($request->filled('branch_id')) {
            $product->loadSum(
                ['inventories as available_stock' => fn ($inventory) => $inventory->where('branch_id', $request->integer('branch_id'))],
                'quantity',
            );
        }

        return new ProductResource($product->load(['category', 'brand', 'unit', 'barcodes']));
    }

    private function normalizeCode(string $value): string
    {
        // Hardware scanners may send whitespace/control characters and an AIM
        // symbology identifier such as ]C1 before the barcode.
        $code = trim((string) preg_replace('/[\x00-\x1F\x7F]/u', '', $value));
        $code = trim(preg_replace('/^\][A-Za-z][0-9]/', '', $code) ?? $code);

        // QR labels may be scanned as a Dukani URL instead of the compact payload.
        if (preg_match('~/(?:products|product)/([0-9a-f-]{36})(?:[/?#]|$)~i', $code, $matches)) {
            return 'dukani:product:'.strtolower($matches[1]);
        }

        return $code;
    }
}
