<?php

namespace App\Http\Controllers\Api\V1\StockTaking;

use App\Http\Controllers\Controller;
use App\Http\Requests\StockTaking\RecordCountsRequest;
use App\Http\Requests\StockTaking\StoreStockTakeRequest;
use App\Models\StockTake;
use App\Services\StockTaking\StockTakeService;
use Illuminate\Http\Request;

class StockTakeController extends Controller
{
    public function __construct(private StockTakeService $service) {}

    public function index(Request $request)
    {
        abort_unless($request->user()->can('stock_takes.manage'), 403);

        return StockTake::with('branch:id,name')
            ->when($request->filled('branch_id'), fn ($q) => $q->where('branch_id', $request->integer('branch_id')))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->orderByDesc('created_at')
            ->paginate($request->integer('per_page', 20));
    }

    public function store(StoreStockTakeRequest $request)
    {
        $stockTake = $this->service->create($request->validated('branch_id'), $request->validated('product_ids'), $request->user());

        return response()->json($stockTake, 201);
    }

    public function show(StockTake $stockTake)
    {
        return $stockTake->load('items.product:id,name,sku', 'branch');
    }

    public function recordCounts(RecordCountsRequest $request, StockTake $stockTake)
    {
        return $this->service->recordCounts($stockTake, $request->validated('counts'));
    }

    public function submit(Request $request, StockTake $stockTake)
    {
        abort_unless($request->user()->can('stock_takes.manage'), 403);

        return $this->service->submit($stockTake);
    }

    public function approve(Request $request, StockTake $stockTake)
    {
        abort_unless($request->user()->can('stock_takes.approve'), 403);

        return $this->service->approve($stockTake, $request->user());
    }
}
