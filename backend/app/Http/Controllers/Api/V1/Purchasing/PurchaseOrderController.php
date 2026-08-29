<?php

namespace App\Http\Controllers\Api\V1\Purchasing;

use App\Http\Controllers\Controller;
use App\Http\Requests\Purchasing\StorePurchaseOrderRequest;
use App\Models\PurchaseOrder;
use App\Services\Purchasing\PurchaseOrderService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PurchaseOrderController extends Controller
{
    public function __construct(private PurchaseOrderService $service) {}

    public function index(Request $request)
    {
        abort_unless($request->user()->can('purchases.manage'), 403);

        return PurchaseOrder::with('supplier:id,name', 'branch:id,name')
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->orderByDesc('created_at')
            ->paginate($request->integer('per_page', 20));
    }

    public function store(StorePurchaseOrderRequest $request)
    {
        $order = $this->service->create($request->validated(), $request->user());

        return response()->json($order, 201);
    }

    public function show(PurchaseOrder $purchaseOrder)
    {
        return $purchaseOrder->load('items.product:id,name,sku', 'supplier', 'branch');
    }

    public function updateStatus(Request $request, PurchaseOrder $purchaseOrder)
    {
        abort_unless($request->user()->can('purchases.manage'), 403);

        $data = $request->validate(['status' => ['required', Rule::in(['sent', 'approved', 'cancelled'])]]);

        return $this->service->updateStatus($purchaseOrder, $data['status']);
    }

    public function convert(Request $request, PurchaseOrder $purchaseOrder)
    {
        abort_unless($request->user()->can('purchases.manage'), 403);

        $purchase = $this->service->convertToPurchase($purchaseOrder, $request->user());

        return response()->json($purchase, 201);
    }
}
