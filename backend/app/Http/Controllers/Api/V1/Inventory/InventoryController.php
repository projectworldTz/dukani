<?php

namespace App\Http\Controllers\Api\V1\Inventory;

use App\Http\Controllers\Controller;
use App\Http\Requests\Inventory\AdjustStockRequest;
use App\Models\Inventory;
use App\Models\Product;
use App\Models\StockMovement;
use App\Services\Inventory\StockMovementService;
use Illuminate\Http\Request;

class InventoryController extends Controller
{
    public function __construct(private StockMovementService $stockMovementService) {}

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
        $movement = $this->stockMovementService->adjust(
            product: $product,
            branchId: $request->validated('branch_id'),
            quantityChange: $request->validated('quantity_change'),
            type: $request->validated('type'),
            reason: $request->validated('reason'),
            userId: $request->user()->id,
        );

        return response()->json($movement, 201);
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
