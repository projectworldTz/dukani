<?php

namespace App\Services\Pharmacy;

use App\Models\ControlledDrugEntry;
use App\Models\Inventory;
use App\Models\Prescription;
use App\Models\Product;
use App\Models\ProductBatch;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\SaleItemBatch;
use App\Models\StockMovement;
use App\Services\Inventory\StockMovementService;
use App\Support\Tenancy\BusinessContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Batch-aware stock for the pharmacy platform. The branch total still lives in
 * `inventories.quantity` (and every change still goes through StockMovementService,
 * so the audit trail is unchanged); this service keeps `product_batches` in step:
 *
 *  - receiving stock records which batch it is and when it expires;
 *  - dispensing takes from the batch that expires first (FEFO) and refuses expired
 *    stock — "sellable" = branch stock minus expired batch units;
 *  - stock that predates batch tracking ("untracked") can still be sold after the
 *    tracked batches, so existing pharmacies keep working the day they switch over;
 *  - every movement of a controlled medicine is written to the controlled drugs register.
 */
class PharmacyStockService
{
    public function __construct(private StockMovementService $stockMovementService) {}

    private function today(): string
    {
        return Carbon::now(request()?->user()?->business?->timezone ?: config('app.timezone'))->toDateString();
    }

    public function branchQuantity(int $productId, int $branchId): int
    {
        return (int) Inventory::where('product_id', $productId)->where('branch_id', $branchId)->value('quantity');
    }

    public function expiredQuantity(int $productId, int $branchId): int
    {
        return (int) ProductBatch::where('product_id', $productId)->where('branch_id', $branchId)
            ->where('quantity_remaining', '>', 0)
            ->whereNotNull('expiry_date')->where('expiry_date', '<', $this->today())
            ->sum('quantity_remaining');
    }

    /** Units that may legally be sold right now (never negative). */
    public function sellableQuantity(int $productId, int $branchId): int
    {
        return max(0, $this->branchQuantity($productId, $branchId) - $this->expiredQuantity($productId, $branchId));
    }

    /** Stock delivered into the pharmacy: a new batch, or more of an existing one. */
    public function receive(
        Product $product,
        int $branchId,
        int $quantity,
        string $batchNumber,
        string $expiryDate,
        string $type = 'purchase',
        ?string $reason = null,
        ?int $userId = null,
        ?string $manufacturedAt = null,
    ): StockMovement {
        if ($quantity <= 0) {
            throw ValidationException::withMessages(['quantity_change' => 'Enter how many units you received.']);
        }
        if ($expiryDate < $this->today()) {
            throw ValidationException::withMessages(['expiry_date' => 'This batch has already expired — expired medicine cannot be added to stock.']);
        }

        return DB::transaction(function () use ($product, $branchId, $quantity, $batchNumber, $expiryDate, $type, $reason, $userId, $manufacturedAt) {
            $batch = ProductBatch::where('product_id', $product->id)->where('branch_id', $branchId)
                ->where('batch_number', $batchNumber)->lockForUpdate()->first();

            if ($batch && $batch->expiry_date && $batch->expiry_date->toDateString() !== $expiryDate) {
                throw ValidationException::withMessages([
                    'expiry_date' => "Batch {$batchNumber} is already recorded with expiry {$batch->expiry_date->format('d/m/Y')}. Check the expiry date or batch number.",
                ]);
            }

            $batch ??= new ProductBatch([
                'business_id' => BusinessContext::id(),
                'product_id' => $product->id,
                'branch_id' => $branchId,
                'batch_number' => $batchNumber,
                'quantity_received' => 0,
                'quantity_remaining' => 0,
            ]);
            $batch->fill([
                'expiry_date' => $expiryDate,
                'manufactured_at' => $manufacturedAt ?? $batch->manufactured_at,
                'quantity_received' => $batch->quantity_received + $quantity,
                'quantity_remaining' => $batch->quantity_remaining + $quantity,
            ])->save();

            $movement = $this->stockMovementService->adjust(
                product: $product,
                branchId: $branchId,
                quantityChange: $quantity,
                type: $type,
                reason: trim(($reason ? "{$reason} · " : '')."Batch {$batchNumber}, exp ".Carbon::parse($expiryDate)->format('d/m/Y')),
                userId: $userId,
            );

            if ($product->is_controlled) {
                $this->register($product, $branchId, 'received', in: $quantity, batch: $batch, reference: "Batch {$batchNumber}", userId: $userId);
            }

            return $movement;
        });
    }

    /**
     * Dispense a sold item: FEFO across unexpired batches, then any untracked stock.
     * Records which batches were used and writes the controlled register when needed.
     */
    public function dispense(SaleItem $item, Product $product, Sale $sale, ?Prescription $prescription, ?int $userId): void
    {
        $quantity = (int) $item->quantity;
        $branchId = $sale->branch_id;

        $sellable = $this->sellableQuantity($product->id, $branchId);
        if ($quantity > $sellable) {
            $expired = $this->expiredQuantity($product->id, $branchId);
            throw ValidationException::withMessages([
                'items' => "Only {$sellable} of \"{$product->name}\" can be sold".($expired > 0 ? " — {$expired} more are expired and must be removed from stock." : '.'),
            ]);
        }

        $batches = ProductBatch::where('product_id', $product->id)->where('branch_id', $branchId)
            ->where('quantity_remaining', '>', 0)
            ->where(fn ($q) => $q->whereNull('expiry_date')->orWhere('expiry_date', '>=', $this->today()))
            ->orderByRaw('expiry_date IS NULL')->orderBy('expiry_date')->orderBy('id')
            ->lockForUpdate()->get();

        $remaining = $quantity;
        foreach ($batches as $batch) {
            if ($remaining <= 0) {
                break;
            }
            $take = min($remaining, $batch->quantity_remaining);
            $batch->decrement('quantity_remaining', $take);
            SaleItemBatch::create([
                'business_id' => BusinessContext::id(),
                'sale_item_id' => $item->id,
                'product_batch_id' => $batch->id,
                'batch_number' => $batch->batch_number,
                'expiry_date' => $batch->expiry_date,
                'quantity' => $take,
            ]);
            $remaining -= $take;
        }

        // Stock recorded before batch tracking (sellable check above guarantees it exists).
        if ($remaining > 0) {
            SaleItemBatch::create([
                'business_id' => BusinessContext::id(),
                'sale_item_id' => $item->id,
                'product_batch_id' => null,
                'quantity' => $remaining,
            ]);
        }

        $this->stockMovementService->adjust(
            product: $product,
            branchId: $branchId,
            quantityChange: -$quantity,
            type: 'sale',
            reference: $sale,
            userId: $userId,
        );

        if ($product->is_controlled) {
            $this->register(
                $product, $branchId, 'dispensed', out: $quantity, sale: $sale, prescription: $prescription,
                reference: str_starts_with((string) $sale->receipt_number, 'PENDING-') ? null : $sale->receipt_number, userId: $userId,
            );
        }
    }

    /** A sellable customer return goes back into the batches it was sold from. */
    public function restoreReturn(SaleItem $item, Product $product, int $quantity, Sale $sale, mixed $reference, ?string $reason, ?int $userId): void
    {
        $remaining = $quantity;
        $allocations = SaleItemBatch::where('sale_item_id', $item->id)->orderByDesc('id')->lockForUpdate()->get();
        foreach ($allocations as $allocation) {
            if ($remaining <= 0) {
                break;
            }
            $put = min($remaining, $allocation->quantity - $allocation->quantity_returned);
            if ($put <= 0) {
                continue;
            }
            $allocation->increment('quantity_returned', $put);
            if ($allocation->product_batch_id) {
                ProductBatch::whereKey($allocation->product_batch_id)->increment('quantity_remaining', $put);
            }
            $remaining -= $put;
        }

        $this->stockMovementService->adjust(
            product: $product,
            branchId: $sale->branch_id,
            quantityChange: $quantity,
            type: 'sale_return',
            reason: $reason,
            reference: $reference,
            userId: $userId,
        );

        if ($product->is_controlled) {
            $this->register($product, $sale->branch_id, 'returned', in: $quantity, sale: $sale, reference: "Return on {$sale->receipt_number}", userId: $userId);
        }
    }

    /**
     * Remove stock that can't be sold (damaged, expired, lost, stolen). Takes from a
     * chosen batch, or — for "expired" — from expired batches first, otherwise FEFO.
     */
    public function remove(Product $product, int $branchId, int $quantity, string $type, ?int $batchId, ?string $reason, ?int $userId): StockMovement
    {
        return DB::transaction(function () use ($product, $branchId, $quantity, $type, $batchId, $reason, $userId) {
            $this->takeFromBatches($product->id, $branchId, $quantity, $batchId, preferExpired: $type === 'expired');

            $movement = $this->stockMovementService->adjust(
                product: $product, branchId: $branchId, quantityChange: -$quantity, type: $type, reason: $reason, userId: $userId,
            );

            if ($product->is_controlled) {
                $this->register($product, $branchId, 'removed', out: $quantity, batch: $batchId ? ProductBatch::find($batchId) : null, reference: ucfirst($type).($reason ? ": {$reason}" : ''), userId: $userId);
            }

            return $movement;
        });
    }

    /**
     * "Fix count": the shelf has $counted units. A shortfall is taken out of batches
     * (expired first — they are the ones that should have gone); extra units must be
     * attributed to a batch, so the caller passes batch details when the count goes up.
     */
    public function correctTo(Product $product, int $branchId, int $counted, ?string $batchNumber, ?string $expiryDate, ?int $userId): StockMovement
    {
        return DB::transaction(function () use ($product, $branchId, $counted, $batchNumber, $expiryDate, $userId) {
            $current = $this->branchQuantity($product->id, $branchId);
            $diff = $counted - $current;

            if ($diff > 0) {
                if (! $batchNumber || ! $expiryDate) {
                    throw ValidationException::withMessages(['batch_number' => 'You counted more than the system shows. Enter the batch number and expiry date of the extra units.']);
                }

                return $this->receive($product, $branchId, $diff, $batchNumber, $expiryDate, 'adjustment', 'Stock count', $userId);
            }

            $this->takeFromBatches($product->id, $branchId, -$diff, null, preferExpired: true);
            $movement = $this->stockMovementService->correctTo(
                product: $product, branchId: $branchId, targetQuantity: $counted, type: 'adjustment', reason: 'Stock count', userId: $userId,
            );

            if ($product->is_controlled && $diff !== 0) {
                $this->register($product, $branchId, 'adjusted', out: -$diff, reference: 'Stock count', userId: $userId);
            }

            return $movement;
        });
    }

    /**
     * Take units out of a branch's batches — FEFO, or expired-first when clearing stock —
     * and report which batches they came from (anything beyond the tracked batches is
     * untracked stock; StockMovementService guards the branch total).
     *
     * @return list<array{batch_number:string,expiry_date:?string,quantity:int}>
     */
    public function takeFromBatches(int $productId, int $branchId, int $quantity, ?int $batchId, bool $preferExpired): array
    {
        $query = ProductBatch::where('product_id', $productId)->where('branch_id', $branchId)->where('quantity_remaining', '>', 0);

        if ($batchId) {
            $batch = (clone $query)->whereKey($batchId)->lockForUpdate()->first();
            if (! $batch || $batch->quantity_remaining < $quantity) {
                throw ValidationException::withMessages(['batch_id' => 'That batch does not have enough units left.']);
            }
            $batch->decrement('quantity_remaining', $quantity);

            return [['batch_number' => $batch->batch_number, 'expiry_date' => $batch->expiry_date?->toDateString(), 'quantity' => $quantity]];
        }

        $batches = $query
            ->when($preferExpired, fn ($q) => $q->orderByRaw('CASE WHEN expiry_date < ? THEN 0 ELSE 1 END', [$this->today()]))
            ->orderByRaw('expiry_date IS NULL')->orderBy('expiry_date')->orderBy('id')
            ->lockForUpdate()->get();

        $taken = [];
        $remaining = $quantity;
        foreach ($batches as $batch) {
            if ($remaining <= 0) {
                break;
            }
            $take = min($remaining, $batch->quantity_remaining);
            $batch->decrement('quantity_remaining', $take);
            $taken[] = ['batch_number' => $batch->batch_number, 'expiry_date' => $batch->expiry_date?->toDateString(), 'quantity' => $take];
            $remaining -= $take;
        }

        return $taken;
    }

    /**
     * Put units back into a named batch at a branch (creating it there if needed) without
     * moving the branch total — the caller posts the stock movement. Used when a transfer
     * arrives so the destination keeps the same batch numbers and expiry dates.
     */
    public function addToBatch(Product $product, int $branchId, string $batchNumber, ?string $expiryDate, int $quantity): ProductBatch
    {
        $batch = ProductBatch::firstOrNew([
            'business_id' => BusinessContext::id(),
            'product_id' => $product->id,
            'branch_id' => $branchId,
            'batch_number' => $batchNumber,
        ]);
        $batch->fill([
            'expiry_date' => $batch->expiry_date ?? $expiryDate,
            'quantity_received' => ($batch->quantity_received ?? 0) + $quantity,
            'quantity_remaining' => ($batch->quantity_remaining ?? 0) + $quantity,
        ])->save();

        return $batch;
    }

    /** Write one line of the controlled drugs register (balance taken after the movement). */
    public function register(
        Product $product,
        int $branchId,
        string $type,
        int $in = 0,
        int $out = 0,
        ?ProductBatch $batch = null,
        ?Sale $sale = null,
        ?Prescription $prescription = null,
        ?string $reference = null,
        ?int $userId = null,
    ): void {
        ControlledDrugEntry::create([
            'business_id' => BusinessContext::id(),
            'branch_id' => $branchId,
            'product_id' => $product->id,
            'product_batch_id' => $batch?->id,
            'type' => $type,
            'quantity_in' => max(0, $in),
            'quantity_out' => max(0, $out),
            'balance_after' => $this->branchQuantity($product->id, $branchId),
            'sale_id' => $sale?->id,
            'prescription_id' => $prescription?->id,
            'patient_name' => $prescription?->patient_name ?? $sale?->customer_name,
            'prescriber_name' => $prescription?->prescriber_name,
            'reference' => $reference,
            'recorded_by' => $userId,
        ]);
    }
}
