<?php

namespace App\Services\Sales;

use App\Models\Branch;
use App\Models\ReceiptCounter;
use App\Support\Tenancy\BusinessContext;
use Illuminate\Support\Facades\DB;

/**
 * Must be called from inside the same DB transaction as the sale it numbers — the row
 * lock here is what serializes concurrent cashiers on the same branch so no two sales
 * ever get the same number (spec §14: "receipt numbers must never be duplicated").
 */
class ReceiptNumberService
{
    public function next(Branch $branch): string
    {
        $counter = ReceiptCounter::where('branch_id', $branch->id)->lockForUpdate()->first();

        if (! $counter) {
            $counter = ReceiptCounter::create([
                'business_id' => BusinessContext::id(),
                'branch_id' => $branch->id,
                'next_number' => 1,
            ]);
            $counter = ReceiptCounter::where('id', $counter->id)->lockForUpdate()->first();
        }

        $number = $counter->next_number;
        $counter->update(['next_number' => $number + 1]);

        $year = now()->year;
        $padded = str_pad((string) $number, 6, '0', STR_PAD_LEFT);

        return "{$branch->code}-POS-{$year}-{$padded}";
    }
}
