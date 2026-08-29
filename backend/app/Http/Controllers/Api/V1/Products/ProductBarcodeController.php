<?php

namespace App\Http\Controllers\Api\V1\Products;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Services\Products\BarcodeImageService;
use App\Services\Products\BarcodeSequenceService;
use App\Services\Products\QrCodeService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ProductBarcodeController extends Controller
{
    public function __construct(
        private BarcodeSequenceService $barcodeSequenceService,
        private BarcodeImageService $barcodeImageService,
        private QrCodeService $qrCodeService,
    ) {}

    public function generate(Request $request, Product $product)
    {
        abort_unless($request->user()->can('products.manage'), 403);

        $barcode = $this->barcodeSequenceService->generateInternal($product, $request->user()->business, (bool) $request->boolean('primary', true));

        return response()->json($barcode, 201);
    }

    public function assign(Request $request, Product $product)
    {
        abort_unless($request->user()->can('products.manage'), 403);

        $data = $request->validate([
            'code' => ['required', 'string', 'max:64'],
            'type' => ['required', Rule::in(['EAN13', 'EAN8', 'UPCA', 'UPCE', 'CODE128'])],
            'primary' => ['nullable', 'boolean'],
        ]);

        $barcode = $this->barcodeSequenceService->assignManual(
            $product, $request->user()->business, $data['code'], $data['type'], (bool) ($data['primary'] ?? false),
        );

        return response()->json($barcode, 201);
    }

    public function barcodeSvg(Product $product)
    {
        $barcode = $product->barcodes()->where('is_primary', true)->first() ?? $product->barcodes()->first();
        abort_if(! $barcode, 404);

        return response($this->barcodeImageService->svg($barcode->code, $barcode->type))
            ->header('Content-Type', 'image/svg+xml');
    }

    public function qrSvg(Product $product)
    {
        $payload = $this->qrCodeService->productPayload($product->uuid);

        return response($this->qrCodeService->svg($payload))
            ->header('Content-Type', 'image/svg+xml');
    }

    /** Bulk label sheet PDF (spec §8) — single/multiple products, N copies each, a few paper sizes. */
    public function labels(Request $request)
    {
        abort_unless($request->user()->can('products.manage'), 403);

        $data = $request->validate([
            'product_ids' => ['required', 'array', 'min:1'],
            'product_ids.*' => ['integer', 'exists:products,id'],
            'copies' => ['nullable', 'integer', 'min:1', 'max:50'],
            'size' => ['nullable', Rule::in(['small', 'medium', 'large'])],
            'include_qr' => ['nullable', 'boolean'],
        ]);

        $products = Product::whereIn('id', $data['product_ids'])->with('barcodes')->get();
        $copies = $data['copies'] ?? 1;
        $includeQr = (bool) ($data['include_qr'] ?? false);

        $labels = [];
        foreach ($products as $product) {
            $barcode = $product->barcodes->firstWhere('is_primary', true) ?? $product->barcodes->first();
            for ($i = 0; $i < $copies; $i++) {
                $labels[] = [
                    'product' => $product,
                    'barcode_svg' => $barcode ? $this->barcodeImageService->svg($barcode->code, $barcode->type) : null,
                    'qr_svg' => $includeQr ? $this->qrCodeService->svg($this->qrCodeService->productPayload($product->uuid), 80) : null,
                ];
            }
        }

        $pdf = Pdf::loadView('labels.sheet', [
            'labels' => $labels,
            'size' => $data['size'] ?? 'medium',
            'businessName' => $request->user()->business->name,
        ]);

        return $pdf->stream('labels.pdf');
    }
}
