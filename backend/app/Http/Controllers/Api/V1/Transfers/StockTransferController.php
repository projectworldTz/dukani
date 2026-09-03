<?php

namespace App\Http\Controllers\Api\V1\Transfers;

use App\Http\Controllers\Controller;
use App\Http\Requests\Transfers\StoreStockTransferRequest;
use App\Models\StockTransfer;
use App\Services\Transfers\StockTransferService;
use Illuminate\Http\Request;

class StockTransferController extends Controller
{
    public function __construct(private StockTransferService $service) {}

    public function index(Request $request)
    {
        abort_unless($request->user()->can('stock_transfers.manage'), 403);

        return StockTransfer::with('fromBranch:id,name', 'toBranch:id,name')
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->when($request->filled('branch_id'), fn ($q) => $q->where(fn ($q2) => $q2
                ->where('from_branch_id', $request->integer('branch_id'))
                ->orWhere('to_branch_id', $request->integer('branch_id'))))
            ->orderByDesc('created_at')
            ->paginate(min(max($request->integer('per_page', 20), 1), 100));
    }

    public function store(StoreStockTransferRequest $request)
    {
        $transfer = $this->service->create($request->validated(), $request->validated('items'), $request->user());

        return response()->json($transfer, 201);
    }

    public function show(StockTransfer $stockTransfer)
    {
        return $stockTransfer->load('items.product:id,name,sku', 'fromBranch', 'toBranch');
    }

    public function request(Request $request, StockTransfer $stockTransfer)
    {
        abort_unless($request->user()->can('stock_transfers.manage'), 403);

        return $this->service->request($stockTransfer);
    }

    public function approve(Request $request, StockTransfer $stockTransfer)
    {
        abort_unless($request->user()->can('stock_transfers.approve'), 403);

        return $this->service->approve($stockTransfer, $request->user());
    }

    public function dispatch(Request $request, StockTransfer $stockTransfer)
    {
        abort_unless($request->user()->can('stock_transfers.manage'), 403);

        return $this->service->dispatch($stockTransfer, $request->user());
    }

    public function receive(Request $request, StockTransfer $stockTransfer)
    {
        abort_unless($request->user()->can('stock_transfers.manage'), 403);

        return $this->service->receive($stockTransfer, $request->user());
    }

    public function cancel(Request $request, StockTransfer $stockTransfer)
    {
        abort_unless($request->user()->can('stock_transfers.manage'), 403);

        return $this->service->cancel($stockTransfer);
    }
}
