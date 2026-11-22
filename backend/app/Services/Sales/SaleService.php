<?php

namespace App\Services\Sales;

use App\Models\Customer;
use App\Models\LoyaltyTransaction;
use App\Models\PaymentMethod;
use App\Models\Prescription;
use App\Models\Product;
use App\Models\RoleLimit;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\User;
use App\Services\Inventory\StockMovementService;
use App\Services\Pharmacy\PharmacyStockService;
use App\Support\Tenancy\BusinessContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * The full checkout flow (spec §56) in one DB transaction: validate stock -> compute
 * totals -> create sale + sale_items (snapshotting product data, spec §57) -> create
 * payment(s) -> decrement stock via StockMovementService (row-locked, spec §45) ->
 * issue a receipt number (spec §14) -> mark completed. Either everything lands, or
 * nothing does.
 */
class SaleService
{
    public function __construct(
        private StockMovementService $stockMovementService,
        private ReceiptNumberService $receiptNumberService,
        private PharmacyStockService $pharmacyStockService,
    ) {}

    /**
     * `hold: true` stops after creating the sale + items — no stock decrement, no
     * payment, no receipt number, no loyalty redemption (spec §10/§30: a held sale is
     * resumable and must not consume anything until it's actually paid for).
     */
    public function createSale(array $data, User $cashier): Sale
    {
        // A retried checkout request (flaky connection, not full offline sync — spec
        // §42) resends the same client-generated key; return the sale already created
        // by the first attempt instead of ringing it up twice.
        if (! empty($data['idempotency_key'])) {
            $existing = Sale::where('idempotency_key', $data['idempotency_key'])->first();
            if ($existing) {
                return $existing->load('items', 'payments.paymentMethod', 'customer');
            }
        }

        return DB::transaction(function () use ($data, $cashier) {
            $branchId = $data['branch_id'];
            $hold = $data['hold'] ?? false;

            [$items, $subtotal, $discountTotal, $taxTotal] = $this->buildItems($data['items'], $cashier);
            $grandTotal = $subtotal - $discountTotal + $taxTotal;

            $sale = Sale::create([
                'business_id' => BusinessContext::id(),
                'branch_id' => $branchId,
                'cashier_id' => $cashier->id,
                'shift_id' => $data['shift_id'] ?? null,
                'customer_id' => $data['customer_id'] ?? null,
                'customer_name' => $data['customer_name'] ?? null,
                'customer_phone' => $data['customer_phone'] ?? null,
                'receipt_number' => 'PENDING-'.Str::random(12),
                'idempotency_key' => $data['idempotency_key'] ?? null,
                'status' => 'held',
                'subtotal' => $subtotal,
                'discount_total' => $discountTotal,
                'tax_total' => $taxTotal,
                'grand_total' => $grandTotal,
                'currency' => $cashier->business->currency,
                'notes' => $data['notes'] ?? null,
            ]);

            foreach ($items as $item) {
                SaleItem::create([...$item, 'business_id' => BusinessContext::id(), 'sale_id' => $sale->id]);
            }

            $this->recordPrescription($sale, $data['prescription'] ?? null, $cashier);

            if ($hold) {
                return $sale->load('items');
            }

            return $this->finalize($sale, $data['payments'] ?? [], $cashier, (int) ($data['redeem_points'] ?? 0));
        });
    }

    public function completeHeldSale(Sale $sale, array $payments, User $cashier, int $redeemPoints = 0): Sale
    {
        if ($sale->status !== 'held') {
            throw ValidationException::withMessages(['sale' => 'This sale is not on hold.']);
        }

        return DB::transaction(fn () => $this->finalize($sale->fresh('items'), $payments, $cashier, $redeemPoints));
    }

    /**
     * Pharmacy platform: prescription-only medicines can't leave the counter without a
     * prescription on record (prescriber, patient, Rx number), stored with the sale.
     */
    private function recordPrescription(Sale $sale, ?array $prescription, User $cashier): void
    {
        if (! $cashier->business->isPharmacy()) {
            return;
        }

        $rxItems = Product::whereIn('id', $sale->items()->pluck('product_id')->filter())
            ->where('requires_prescription', true)->pluck('name');

        if ($rxItems->isNotEmpty()) {
            $missing = collect(['prescriber_name' => "the prescriber's name", 'patient_name' => "the patient's name", 'rx_number' => 'the prescription number'])
                ->filter(fn ($label, $key) => blank($prescription[$key] ?? null));
            if ($missing->isNotEmpty()) {
                throw ValidationException::withMessages([
                    'prescription' => 'A prescription is required for '.$rxItems->join(', ', ' and ').'. Please enter '.$missing->values()->join(', ', ' and ').'.',
                ]);
            }
        }

        if ($prescription && filled($prescription['patient_name'] ?? null) && filled($prescription['rx_number'] ?? null)) {
            Prescription::create([
                'business_id' => BusinessContext::id(),
                'sale_id' => $sale->id,
                'rx_number' => $prescription['rx_number'],
                'prescriber_name' => $prescription['prescriber_name'] ?? '',
                'prescriber_reg_no' => $prescription['prescriber_reg_no'] ?? null,
                'facility' => $prescription['facility'] ?? null,
                'issued_on' => $prescription['issued_on'] ?? null,
                'patient_name' => $prescription['patient_name'],
                'patient_age' => $prescription['patient_age'] ?? null,
                'patient_phone' => $prescription['patient_phone'] ?? null,
                'notes' => $prescription['notes'] ?? null,
                'recorded_by' => $cashier->id,
            ]);
        }
    }

    private function finalize(Sale $sale, array $payments, User $cashier, int $redeemPoints = 0): Sale
    {
        $branch = $sale->branch;
        $isPharmacy = $cashier->business->isPharmacy();
        $prescription = $isPharmacy ? $sale->prescription()->first() : null;

        foreach ($sale->items as $item) {
            if (! $item->product_id) {
                continue;
            }

            $product = Product::findOrFail($item->product_id);

            // Pharmacy medicines: nearest-expiry batch first, never expired stock.
            if ($isPharmacy && $product->has_batch) {
                $this->pharmacyStockService->dispense($item, $product, $sale, $prescription, $cashier->id);

                continue;
            }

            $this->stockMovementService->adjust(
                product: $product,
                branchId: $sale->branch_id,
                quantityChange: -$item->quantity,
                type: 'sale',
                reference: $sale,
                userId: $cashier->id,
            );
        }

        $grandTotal = (float) $sale->grand_total;
        $customer = $sale->customer_id ? Customer::find($sale->customer_id) : null;
        $loyaltyDiscount = $this->applyRedemption($sale, $customer, $redeemPoints, $cashier->business->settings);

        if ($loyaltyDiscount > 0) {
            $grandTotal = max(0, $grandTotal - $loyaltyDiscount);
            $sale->update(['discount_total' => (float) $sale->discount_total + $loyaltyDiscount, 'grand_total' => $grandTotal]);
        }

        $amountPaid = 0;
        $cashPaid = 0;
        foreach ($payments as $payment) {
            $paymentMethod = PaymentMethod::findOrFail($payment['payment_method_id']);
            $sale->payments()->create([
                'business_id' => BusinessContext::id(),
                'payment_method_id' => $payment['payment_method_id'],
                'amount' => $payment['amount'],
                'reference' => $payment['reference'] ?? null,
                'received_by' => $cashier->id,
            ]);
            $amountPaid += $payment['amount'];
            if ($paymentMethod->type === 'cash') {
                $cashPaid += $payment['amount'];
            }
        }

        $shortfall = round($grandTotal - $amountPaid, 2);

        if ($shortfall > 0) {
            $this->assertCreditAllowed($sale, $customer, $shortfall, $cashier);
        }

        $overpayment = round($amountPaid - $grandTotal, 2);
        if ($overpayment > 0 && $cashPaid < $overpayment) {
            throw ValidationException::withMessages([
                'payments' => 'Card and mobile payments cannot exceed the amount due. Adjust the payment amounts.',
            ]);
        }

        $change = max(0, $amountPaid - $grandTotal);

        $sale->update([
            'receipt_number' => $this->receiptNumberService->next($branch),
            'status' => 'completed',
            'amount_paid' => $amountPaid,
            'change_amount' => $change,
            'receipt_verification_token' => Str::random(40),
            'completed_at' => now(),
        ]);

        $this->awardLoyaltyPoints($sale, $customer, $cashier->business->settings);

        return $sale->fresh(['items.batches', 'payments.paymentMethod', 'customer', 'prescription']);
    }

    /**
     * Spec §23: businesses may sell on credit "where permitted" — gated by a dedicated
     * permission (not implied by sales.create) plus the customer's own credit limit,
     * so a cashier can't extend unlimited credit just because they can ring up sales.
     */
    private function assertCreditAllowed(Sale $sale, ?Customer $customer, float $shortfall, User $cashier): void
    {
        if (! $customer) {
            throw ValidationException::withMessages([
                'payments' => "Amount paid is {$shortfall} short of the total due. Select a customer to sell on credit.",
            ]);
        }

        if (! $cashier->can('sales.credit.apply')) {
            throw ValidationException::withMessages(['payments' => 'You are not permitted to sell on credit.']);
        }

        if ($shortfall > $customer->availableCredit()) {
            throw ValidationException::withMessages([
                'payments' => "This would exceed {$customer->name}'s available credit (".number_format($customer->availableCredit(), 2).' remaining).',
            ]);
        }
    }

    /** Spec §24: redeeming points reduces the amount due, applied as an extra discount. */
    private function applyRedemption(Sale $sale, ?Customer $customer, int $redeemPoints, $settings): float
    {
        if ($redeemPoints <= 0) {
            return 0;
        }

        if (! $settings?->loyalty_enabled || ! $customer) {
            throw ValidationException::withMessages(['redeem_points' => 'Loyalty redemption is not available for this sale.']);
        }

        if ($redeemPoints > $customer->loyalty_points) {
            throw ValidationException::withMessages(['redeem_points' => "{$customer->name} only has {$customer->loyalty_points} points."]);
        }

        $discount = round($redeemPoints * (float) $settings->loyalty_point_value, 2);

        LoyaltyTransaction::create([
            'business_id' => BusinessContext::id(),
            'customer_id' => $customer->id,
            'sale_id' => $sale->id,
            'type' => 'redeemed',
            'points' => $redeemPoints,
            'notes' => "Redeemed at checkout for {$sale->currency} {$discount} off",
        ]);
        $customer->decrement('loyalty_points', $redeemPoints);
        $sale->update(['loyalty_points_redeemed' => $redeemPoints]);

        return $discount;
    }

    private function awardLoyaltyPoints(Sale $sale, ?Customer $customer, $settings): void
    {
        if (! $settings?->loyalty_enabled || ! $customer || (float) $settings->loyalty_spend_per_point <= 0) {
            return;
        }

        $points = (int) floor((float) $sale->grand_total / (float) $settings->loyalty_spend_per_point);

        if ($points <= 0) {
            return;
        }

        LoyaltyTransaction::create([
            'business_id' => BusinessContext::id(),
            'customer_id' => $customer->id,
            'sale_id' => $sale->id,
            'type' => 'earned',
            'points' => $points,
            'notes' => "Earned from sale {$sale->receipt_number}",
        ]);
        $customer->increment('loyalty_points', $points);
        $sale->update(['loyalty_points_earned' => $points]);
    }

    private function buildItems(array $cartItems, User $cashier): array
    {
        $subtotal = 0;
        $discountTotal = 0;
        $taxTotal = 0;
        $items = [];

        $maxDiscountPercent = $this->maxDiscountPercentFor($cashier);

        foreach ($cartItems as $line) {
            $product = Product::findOrFail($line['product_id']);
            $quantity = (int) $line['quantity'];
            $unitPrice = (float) ($line['unit_price'] ?? $product->selling_price);
            $discountAmount = (float) ($line['discount_amount'] ?? 0);
            // Weighed products: quantity is in grams, price is per kg.
            $divisor = $product->sold_by_weight ? \App\Support\Butchery\ButcheryCatalog::GRAMS_PER_KG : 1;
            $lineGross = round($unitPrice * $quantity / $divisor, 2);

            if ($discountAmount > $lineGross) {
                throw ValidationException::withMessages([
                    'items' => "Discount for {$product->name} cannot exceed its line total.",
                ]);
            }

            if ($discountAmount > 0) {
                if (! $cashier->can('sales.discount.apply')) {
                    throw ValidationException::withMessages(['items' => 'You are not permitted to apply a discount.']);
                }

                if ($maxDiscountPercent !== null && $lineGross > 0) {
                    $discountPercent = ($discountAmount / $lineGross) * 100;
                    if ($discountPercent > $maxDiscountPercent) {
                        throw ValidationException::withMessages([
                            'items' => "Discount exceeds your approval limit of {$maxDiscountPercent}%.",
                        ]);
                    }
                }
            }

            $taxableAmount = max(0, $lineGross - $discountAmount);
            $taxRate = (float) $product->tax_rate;
            $taxAmount = $product->is_tax_inclusive
                ? $taxableAmount - ($taxableAmount / (1 + $taxRate / 100))
                : $taxableAmount * ($taxRate / 100);
            $lineTotal = $product->is_tax_inclusive ? $taxableAmount : $taxableAmount + $taxAmount;

            $items[] = [
                'product_id' => $product->id,
                'product_name' => $product->name,
                'sku' => $product->sku,
                'quantity' => $quantity,
                'price_divisor' => $divisor,
                'unit_price' => $unitPrice,
                'cost_price' => $product->cost_price,
                'discount_amount' => $discountAmount,
                'tax_amount' => round($taxAmount, 2),
                'line_total' => round($lineTotal, 2),
                'dosage_instructions' => filled($line['dosage_instructions'] ?? null) ? trim($line['dosage_instructions']) : null,
            ];

            $subtotal += $lineGross;
            $discountTotal += $discountAmount;
            $taxTotal += $taxAmount;
        }

        return [$items, round($subtotal, 2), round($discountTotal, 2), round($taxTotal, 2)];
    }

    private function maxDiscountPercentFor(User $cashier): ?float
    {
        $roleIds = $cashier->roles()->pluck('id');

        $limit = RoleLimit::where('business_id', BusinessContext::id())
            ->whereIn('role_id', $roleIds)
            ->where('key', 'max_discount_percent')
            ->orderByDesc('value')
            ->first();

        // No configured role_limit row = no cap (spec's examples describe the Business
        // Owner opting a role INTO a limit, not everyone starting capped by default).
        return $limit ? (float) $limit->value : null;
    }
}
