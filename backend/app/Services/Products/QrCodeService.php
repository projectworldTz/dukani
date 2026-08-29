<?php

namespace App\Services\Products;

use SimpleSoftwareIO\QrCode\Facades\QrCode;

/**
 * QR payloads are opaque, prefixed strings (`dukani:product:{uuid}`,
 * `dukani:receipt:{token}`) — never raw pricing/DB rows or a sequential id, per
 * spec §7/§13's "don't expose sensitive data through the QR code". The prefix lets a
 * single scan-lookup endpoint route to the right resolver without guessing.
 */
class QrCodeService
{
    public function productPayload(string $uuid): string
    {
        return "dukani:product:{$uuid}";
    }

    public function receiptPayload(string $token): string
    {
        return "dukani:receipt:{$token}";
    }

    /**
     * SVG only — simple-qrcode's PNG backend requires the ext-imagick PHP extension
     * (not installed in this environment; it's an optional "suggest", not a hard
     * dependency, in the package's own composer.json). SVG needs nothing beyond
     * bacon/bacon-qr-code and renders fine in-browser and inside dompdf receipts.
     */
    public function svg(string $payload, int $size = 200): string
    {
        return QrCode::size($size)->format('svg')->generate($payload);
    }
}
