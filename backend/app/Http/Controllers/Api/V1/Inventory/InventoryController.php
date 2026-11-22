<?php

namespace App\Http\Controllers\Api\V1\Inventory;

use App\Http\Controllers\Controller;
use App\Http\Requests\Inventory\AdjustStockRequest;
use App\Models\Inventory;
use App\Models\Product;
use App\Models\StockMovement;
use App\Services\Inventory\StockMovementService;
use App\Services\Pharmacy\PharmacyStockService;
use Illuminate\Validation\ValidationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InventoryController extends Controller
{
    public function __construct(
        private StockMovementService $stockMovementService,
        private PharmacyStockService $pharmacyStockService,
    ) {}

    public function index(Request $request)
    {
        abort_unless($request->user()->can('inventory.view'), 403);

        $inventories = Inventory::query()
            ->select('inventories.*')
            ->with('product:id,name,sku,reorder_level', 'branch:id,name')
            ->when($request->filled('branch_id'), fn ($q) => $q->where('inventories.branch_id', $request->integer('branch_id')))
            ->when($request->boolean('low_stock'), fn ($q) => $q
                ->join('products', 'products.id', '=', 'inventories.product_id')
                ->whereRaw('inventories.quantity <= COALESCE(inventories.reorder_level, products.reorder_level)'))
            ->paginate(min(max($request->integer('per_page', 20), 1), 100));

        return $inventories;
    }

    public function adjust(AdjustStockRequest $request, Product $product)
    {
        $data = $request->validated();
        $userId = $request->user()->id;

        $isPharmacyBatch = $product->has_batch && $request->user()->business->isPharmacy();

        $movement = DB::transaction(function () use ($data, $product, $userId, $isPharmacyBatch) {
            $movement = $isPharmacyBatch
                ? $this->adjustPharmacyBatch($product, $data, $userId)
                : (isset($data['counted_quantity'])
                ? $this->stockMovementService->correctTo(
                    product: $product,
                    branchId: $data['branch_id'],
                    targetQuantity: $data['counted_quantity'],
                    type: $data['type'],
                    reason: $data['reason'] ?? 'Stock count',
                    userId: $userId,
                )
                : $this->stockMovementService->adjust(
                    product: $product,
                    branchId: $data['branch_id'],
                    quantityChange: $data['quantity_change'],
                    type: $data['type'],
                    reason: $data['reason'] ?? null,
                    userId: $userId,
                ));

            // Restocking at a new supplier price keeps the product's cost (and so the
            // profit report) current without a separate "edit product" step.
            if (isset($data['unit_cost']) && ($data['quantity_change'] ?? 0) > 0) {
                $product->update(['cost_price' => $data['unit_cost']]);
            }

            return $movement;
        });

        return response()->json($movement, 201);
    }

    /** Pharmacy medicines: every stock change names a batch (arriving) or comes out of batches (leaving). */
    private function adjustPharmacyBatch(Product $product, array $data, int $userId)
    {
        $branchId = (int) $data['branch_id'];

        if (isset($data['counted_quantity'])) {
            return $this->pharmacyStockService->correctTo($product, $branchId, (int) $data['counted_quantity'], $data['batch_number'] ?? null, $data['expiry_date'] ?? null, $userId);
        }

        $change = (int) $data['quantity_change'];
        if ($change > 0) {
            if (blank($data['batch_number'] ?? null) || blank($data['expiry_date'] ?? null)) {
                throw ValidationException::withMessages(['batch_number' => 'Enter the batch number and expiry date printed on the pack.']);
            }

            return $this->pharmacyStockService->receive(
                $product, $branchId, $change, trim($data['batch_number']), $data['expiry_date'],
                $data['type'] === 'opening_stock' ? 'opening_stock' : ($data['type'] === 'adjustment' ? 'adjustment' : 'purchase'),
                $data['reason'] ?? null, $userId, $data['manufactured_at'] ?? null,
            );
        }

        return $this->pharmacyStockService->remove($product, $branchId, -$change, $data['type'], $data['batch_id'] ?? null, $data['reason'] ?? null, $userId);
    }

    public function movements(Request $request, Product $product)
    {
        abort_unless($request->user()->can('inventory.view'), 403);

        return StockMovement::where('product_id', $product->id)
            ->with('branch:id,name', 'user:id,name')
            ->orderByDesc('created_at')
            ->paginate(min(max($request->integer('per_page', 20), 1), 100));
    }
}
