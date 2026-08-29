<?php

namespace App\Services\Transfers;

use App\Models\Product;
use App\Models\StockTransfer;
use App\Models\User;
use App\Services\Inventory\StockMovementService;
use App\Services\Shared\DocumentNumberService;
use App\Support\Tenancy\BusinessContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Workflow (spec §33): draft -> requested -> approved -> in_transit -> received (or
 * cancelled at any point before received). Stock actually moves in two steps, not one:
 * it leaves the source branch when dispatched (in_transit) and only lands in the
 * destination branch once received — matching "goods are on a truck, in neither
 * branch's countable stock" rather than teleporting instantly.
 */
class StockTransferService
{
    public function __construct(
        private DocumentNumberService $numberService,
        private StockMovementService $stockMovementService,
    ) {}

    /** @param  array<int,array{product_id:int,quantity:int}>  $items */
    public function create(array $data, array $items, User $user): StockTransfer
    {
        if ($data['from_branch_id'] === $data['to_branch_id']) {
            throw ValidationException::withMessages(['to_branch_id' => 'Source and destination branch must differ.']);
        }

        return DB::transaction(function () use ($data, $items, $user) {
            $transfer = StockTransfer::create([
                'business_id' => BusinessContext::id(),
                'from_branch_id' => $data['from_branch_id'],
                'to_branch_id' => $data['to_branch_id'],
                'transfer_number' => 'TRF-'.$this->numberService->next('', 'stock_transfers'),
                'status' => 'draft',
                'notes' => $data['notes'] ?? null,
                'requested_by' => $user->id,
            ]);

            foreach ($items as $item) {
                $transfer->items()->create([
                    'business_id' => BusinessContext::id(),
                    'product_id' => $item['product_id'],
                    'quantity' => $item['quantity'],
                ]);
            }

            return $transfer->load('items');
        });
    }

    public function request(StockTransfer $transfer): StockTransfer
    {
        $this->assertStatus($transfer, 'draft');
        $transfer->update(['status' => 'requested']);

        return $transfer;
    }

    public function approve(StockTransfer $transfer, User $approver): StockTransfer
    {
        $this->assertStatus($transfer, 'requested');
        $transfer->update(['status' => 'approved', 'approved_by' => $approver->id]);

        return $transfer;
    }

    public function dispatch(StockTransfer $transfer, User $user): StockTransfer
    {
        $this->assertStatus($transfer, 'approved');

        return DB::transaction(function () use ($transfer, $user) {
            foreach ($transfer->items as $item) {
                $this->stockMovementService->adjust(
                    product: Product::findOrFail($item->product_id),
                    branchId: $transfer->from_branch_id,
                    quantityChange: -$item->quantity,
                    type: 'transfer_out',
                    reference: $transfer,
                    userId: $user->id,
                );
            }

            $transfer->update(['status' => 'in_transit', 'dispatched_at' => now()]);

            return $transfer;
        });
    }

    public function receive(StockTransfer $transfer, User $user): StockTransfer
    {
        $this->assertStatus($transfer, 'in_transit');

        return DB::transaction(function () use ($transfer, $user) {
            foreach ($transfer->items as $item) {
                $this->stockMovementService->adjust(
                    product: Product::findOrFail($item->product_id),
                    branchId: $transfer->to_branch_id,
                    quantityChange: $item->quantity,
                    type: 'transfer_in',
                    reference: $transfer,
                    userId: $user->id,
                );
            }

            $transfer->update(['status' => 'received', 'received_by' => $user->id, 'received_at' => now()]);

            return $transfer;
        });
    }

    public function cancel(StockTransfer $transfer): StockTransfer
    {
        if (in_array($transfer->status, ['received', 'cancelled'], true)) {
            throw ValidationException::withMessages(['status' => 'This transfer can no longer be cancelled.']);
        }

        if ($transfer->status === 'in_transit') {
            throw ValidationException::withMessages(['status' => 'Stock has already left the source branch — receive it, then use a return transfer instead of cancelling.']);
        }

        $transfer->update(['status' => 'cancelled']);

        return $transfer;
    }

    private function assertStatus(StockTransfer $transfer, string $expected): void
    {
        if ($transfer->status !== $expected) {
            throw ValidationException::withMessages([
                'status' => "This transfer must be '{$expected}' for this action (currently '{$transfer->status}').",
            ]);
        }
    }
}
