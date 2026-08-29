<?php

namespace App\Services\Quotations;

use App\Models\Product;
use App\Models\Quotation;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\User;
use App\Services\Shared\DocumentNumberService;
use App\Support\Tenancy\BusinessContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class QuotationService
{
    public function __construct(private DocumentNumberService $numberService) {}

    /** @param  array<int,array{product_id:int,quantity:int,unit_price?:float,discount_amount?:float}>  $items */
    public function create(array $data, array $items, User $user): Quotation
    {
        return DB::transaction(function () use ($data, $items, $user) {
            [$lines, $totals] = $this->buildLines($items);

            $quotation = Quotation::create([
                'business_id' => BusinessContext::id(),
                'branch_id' => $data['branch_id'],
                'customer_id' => $data['customer_id'] ?? null,
                'customer_name' => $data['customer_name'] ?? null,
                'quotation_number' => 'QUO-'.$this->numberService->next('', 'quotations'),
                'status' => 'draft',
                'subtotal' => $totals['subtotal'],
                'discount_total' => $totals['discount_total'],
                'tax_total' => $totals['tax_total'],
                'grand_total' => $totals['grand_total'],
                'valid_until' => $data['valid_until'] ?? null,
                'notes' => $data['notes'] ?? null,
                'payment_terms' => $data['payment_terms'] ?? null,
                'created_by' => $user->id,
            ]);

            foreach ($lines as $line) {
                $quotation->items()->create([...$line, 'business_id' => BusinessContext::id()]);
            }

            return $quotation->load('items');
        });
    }

    public function updateStatus(Quotation $quotation, string $status): Quotation
    {
        if ($quotation->status === 'converted') {
            throw ValidationException::withMessages(['status' => 'This quotation has already been converted to a sale.']);
        }

        $quotation->update(['status' => $status]);

        return $quotation;
    }

    /**
     * Editing is blocked once a quotation has become a real sale — its line prices are
     * frozen into the sale at that point (see convertToSale below), so changing them
     * here afterward would silently desync the two documents.
     *
     * @param  array<int,array{product_id:int,quantity:int,unit_price?:float,discount_amount?:float}>|null  $items
     */
    public function update(Quotation $quotation, array $data, ?array $items, User $user): Quotation
    {
        if ($quotation->status === 'converted') {
            throw ValidationException::withMessages(['status' => 'This quotation has already been converted to a sale and can no longer be edited.']);
        }

        return DB::transaction(function () use ($quotation, $data, $items, $user) {
            $header = array_intersect_key($data, array_flip(['branch_id', 'customer_id', 'customer_name', 'valid_until', 'notes', 'payment_terms']));

            if ($items !== null) {
                [$lines, $totals] = $this->buildLines($items);

                $quotation->items()->delete();
                foreach ($lines as $line) {
                    $quotation->items()->create([...$line, 'business_id' => BusinessContext::id()]);
                }

                $header = [...$header, ...$totals];
            }

            $quotation->update($header);

            return $quotation->load('items');
        });
    }

    /**
     * Starts a fresh draft from an existing quotation's items/customer — a quick way to
     * re-quote the same basket (e.g. after the original expired) without retyping it.
     */
    public function duplicate(Quotation $quotation, User $user): Quotation
    {
        return DB::transaction(function () use ($quotation, $user) {
            $quotation->loadMissing('items');

            $copy = Quotation::create([
                'business_id' => BusinessContext::id(),
                'branch_id' => $quotation->branch_id,
                'customer_id' => $quotation->customer_id,
                'customer_name' => $quotation->customer_name,
                'quotation_number' => 'QUO-'.$this->numberService->next('', 'quotations'),
                'status' => 'draft',
                'subtotal' => $quotation->subtotal,
                'discount_total' => $quotation->discount_total,
                'tax_total' => $quotation->tax_total,
                'grand_total' => $quotation->grand_total,
                'valid_until' => now()->addDays(7)->toDateString(),
                'notes' => $quotation->notes,
                'payment_terms' => $quotation->payment_terms,
                'created_by' => $user->id,
            ]);

            foreach ($quotation->items as $item) {
                $copy->items()->create([
                    'business_id' => BusinessContext::id(),
                    'product_id' => $item->product_id,
                    'product_name' => $item->product_name,
                    'quantity' => $item->quantity,
                    'unit_price' => $item->unit_price,
                    'discount_amount' => $item->discount_amount,
                    'tax_amount' => $item->tax_amount,
                    'line_total' => $item->line_total,
                ]);
            }

            return $copy->load('items');
        });
    }

    /**
     * @param  array<int,array{product_id:int,quantity:int,unit_price?:float,discount_amount?:float}>  $items
     * @return array{0: array<int,array<string,mixed>>, 1: array{subtotal:float,discount_total:float,tax_total:float,grand_total:float}}
     */
    private function buildLines(array $items): array
    {
        $subtotal = 0;
        $discountTotal = 0;
        $taxTotal = 0;
        $lines = [];

        foreach ($items as $line) {
            $product = Product::findOrFail($line['product_id']);
            $quantity = (int) $line['quantity'];
            $unitPrice = (float) ($line['unit_price'] ?? $product->selling_price);
            $discountAmount = (float) ($line['discount_amount'] ?? 0);
            $gross = $unitPrice * $quantity;
            $taxable = max(0, $gross - $discountAmount);
            $taxAmount = round($taxable * ((float) $product->tax_rate / 100), 2);

            $lines[] = [
                'product_id' => $product->id,
                'product_name' => $product->name,
                'quantity' => $quantity,
                'unit_price' => $unitPrice,
                'discount_amount' => $discountAmount,
                'tax_amount' => $taxAmount,
                'line_total' => round($taxable + $taxAmount, 2),
            ];

            $subtotal += $gross;
            $discountTotal += $discountAmount;
            $taxTotal += $taxAmount;
        }

        return [$lines, [
            'subtotal' => round($subtotal, 2),
            'discount_total' => round($discountTotal, 2),
            'tax_total' => round($taxTotal, 2),
            'grand_total' => round($subtotal - $discountTotal + $taxTotal, 2),
        ]];
    }

    /**
     * Spec §31: a quotation becomes a sale. Builds the held sale directly from the
     * quotation's own frozen line prices/discounts/tax rather than recomputing against
     * live product prices, so what the customer was quoted is exactly what they pay —
     * the cashier then completes payment through the normal hold/resume checkout flow.
     */
    public function convertToSale(Quotation $quotation, User $cashier): Sale
    {
        if ($quotation->status === 'converted') {
            throw ValidationException::withMessages(['status' => 'This quotation has already been converted.']);
        }

        return DB::transaction(function () use ($quotation, $cashier) {
            $quotation->load('items');

            $sale = Sale::create([
                'business_id' => BusinessContext::id(),
                'branch_id' => $quotation->branch_id,
                'cashier_id' => $cashier->id,
                'customer_id' => $quotation->customer_id,
                'customer_name' => $quotation->customer_name,
                'receipt_number' => 'PENDING-'.Str::random(12),
                'status' => 'held',
                'subtotal' => $quotation->subtotal,
                'discount_total' => $quotation->discount_total,
                'tax_total' => $quotation->tax_total,
                'grand_total' => $quotation->grand_total,
                'currency' => $cashier->business->currency,
                'notes' => "Converted from quotation {$quotation->quotation_number}",
            ]);

            foreach ($quotation->items as $item) {
                $product = $item->product_id ? Product::find($item->product_id) : null;

                SaleItem::create([
                    'business_id' => BusinessContext::id(),
                    'sale_id' => $sale->id,
                    'product_id' => $item->product_id,
                    'product_name' => $item->product_name,
                    'sku' => $product?->sku,
                    'quantity' => $item->quantity,
                    'unit_price' => $item->unit_price,
                    'cost_price' => $product?->cost_price ?? 0,
                    'discount_amount' => $item->discount_amount,
                    'tax_amount' => $item->tax_amount,
                    'line_total' => $item->line_total,
                ]);
            }

            $quotation->update(['status' => 'converted', 'converted_sale_id' => $sale->id]);

            return $sale->load('items');
        });
    }
}
