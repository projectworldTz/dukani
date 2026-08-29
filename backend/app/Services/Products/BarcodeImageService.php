<?php

namespace App\Services\Products;

use Picqer\Barcode\BarcodeGeneratorPNG;
use Picqer\Barcode\BarcodeGeneratorSVG;

class BarcodeImageService
{
    private const TYPE_MAP = [
        'EAN13' => BarcodeGeneratorPNG::TYPE_EAN_13,
        'EAN8' => BarcodeGeneratorPNG::TYPE_EAN_8,
        'UPCA' => BarcodeGeneratorPNG::TYPE_UPC_A,
        'UPCE' => BarcodeGeneratorPNG::TYPE_UPC_E,
        'CODE128' => BarcodeGeneratorPNG::TYPE_CODE_128,
        'INTERNAL' => BarcodeGeneratorPNG::TYPE_CODE_128,
    ];

    public function svg(string $code, string $type): string
    {
        $generator = new BarcodeGeneratorSVG;

        return $generator->getBarcode($code, self::TYPE_MAP[$type] ?? BarcodeGeneratorSVG::TYPE_CODE_128);
    }

    public function pngDataUri(string $code, string $type): string
    {
        $generator = new BarcodeGeneratorPNG;
        $png = $generator->getBarcode($code, self::TYPE_MAP[$type] ?? BarcodeGeneratorPNG::TYPE_CODE_128);

        return 'data:image/png;base64,'.base64_encode($png);
    }
}
