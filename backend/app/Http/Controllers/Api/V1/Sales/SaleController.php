<?php

namespace App\Http\Controllers\Api\V1\Sales;

use App\Http\Controllers\Controller;
use App\Http\Requests\Sales\CompleteHeldSaleRequest;
use App\Http\Requests\Sales\StoreSaleRequest;
use App\Http\Resources\SaleResource;
use App\Models\Sale;
use App\Services\Sales\SaleService;
use Illuminate\Http\Request;

class SaleController extends Controller
{
    public function __construct(private SaleService $saleService) {}

    public function index(Request $request)
    {
        $canViewAll = $request->user()->can('sales.view.all');
        abort_unless($canViewAll || $request->user()->can('sales.view.own'), 403);

        $sales = Sale::with('cashier:id,name')
            ->when(! $canViewAll, fn ($q) => $q->where('cashier_id', $request->user()->id))
            ->when($request->filled('branch_id'), fn ($q) => $q->where('branch_id', $request->integer('branch_id')))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->when($request->filled('receipt_number'), fn ($q) => $q->where('receipt_number', 'like', '%'.$request->string('receipt_number').'%'))
            ->orderByDesc('created_at')
            ->paginate($request->integer('per_page', 20));

        return SaleResource::collection($sales);
    }

    public function store(StoreSaleRequest $request)
    {
        $sale = $this->saleService->createSale($request->validated(), $request->user());

        return (new SaleResource($sale->load('items', 'payments.paymentMethod', 'cashier')))
            ->response()
            ->setStatusCode(201);
    }

    public function show(Request $request, Sale $sale)
    {
        $canViewAll = $request->user()->can('sales.view.all');
        abort_unless($canViewAll || ($request->user()->can('sales.view.own') && $sale->cashier_id === $request->user()->id), 403);

        return new SaleResource($sale->load('items', 'payments.paymentMethod', 'cashier'));
    }

    public function completeHeld(CompleteHeldSaleRequest $request, Sale $sale)
    {
        $completed = $this->saleService->completeHeldSale(
            $sale,
            $request->validated('payments'),
            $request->user(),
            (int) $request->validated('redeem_points', 0),
        );

        return new SaleResource($completed);
    }

    public function held(Request $request)
    {
        abort_unless($request->user()->can('sales.create'), 403);

        $held = Sale::where('status', 'held')
            ->where('branch_id', $request->integer('branch_id'))
            ->with('items')
            ->orderByDesc('created_at')
            ->get();

        return SaleResource::collection($held);
    }
}
