<?php

namespace App\Services\Shared;

use App\Support\Tenancy\BusinessContext;
use Illuminate\Support\Facades\DB;

/**
 * Shared numbering helper for the lower-concurrency Phase 2 documents (purchase
 * orders, purchases, transfers, stock takes, returns) — a locked live COUNT of
 * existing rows for the business, the same approach
 * App\Services\Products\BarcodeSequenceService uses for internal barcodes. These
 * aren't created at checkout's concurrency rate, so this is simpler than the
 * dedicated `receipt_counters` table App\Services\Sales\ReceiptNumberService uses.
 */
class DocumentNumberService
{
    public function next(string $prefix, string $table): string
    {
        return DB::transaction(function () use ($prefix, $table) {
            $count = DB::table($table)->where('business_id', BusinessContext::id())->lockForUpdate()->count();

            return $prefix.str_pad((string) ($count + 1), 6, '0', STR_PAD_LEFT);
        });
    }
}
