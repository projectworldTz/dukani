<?php

namespace App\Http\Controllers\Api\V1\Purchasing;

use App\Http\Controllers\Controller;
use App\Http\Requests\Purchasing\ReceivePurchaseRequest;
use App\Http\Requests\Purchasing\RecordSupplierPaymentRequest;
use App\Http\Requests\Purchasing\StorePurchaseRequest;
use App\Models\Purchase;
use App\Services\Purchasing\PurchaseService;
use Illuminate\Http\Request;

class PurchaseController extends Controller
{
    public function __construct(private PurchaseService $service) {}

    public function index(Request $request)
    {
        abort_unless($request->user()->can('purchases.manage'), 403);

        return Purchase::with('supplier:id,name', 'branch:id,name')
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->when($request->filled('supplier_id'), fn ($q) => $q->where('supplier_id', $request->integer('supplier_id')))
            ->orderByDesc('created_at')
            ->paginate(min(max($request->integer('per_page', 20), 1), 100));
    }

    public function store(StorePurchaseRequest $request)
    {
        $purchase = $this->service->create($request->validated(), $request->user());

        return response()->json($purchase, 201);
    }

    public function show(Purchase $purchase)
    {
        return $purchase->load('items.product:id,name,sku', 'supplier', 'branch', 'payments.paymentMethod');
    }

    public function receive(ReceivePurchaseRequest $request, Purchase $purchase)
    {
        $updated = $this->service->receive($purchase, $request->validated('receipts'), $request->user());

        return $updated;
    }

    public function recordPayment(RecordSupplierPaymentRequest $request, Purchase $purchase)
    {
        $payment = $this->service->recordPayment(
            $purchase,
            (float) $request->validated('amount'),
            $request->validated('payment_method_id'),
            $request->validated('reference'),
            $request->user(),
        );

        return response()->json($payment, 201);
    }
}
