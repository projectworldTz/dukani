<?php

namespace App\Http\Controllers\Api\V1\Sales;

use App\Http\Controllers\Controller;
use App\Http\Requests\Sales\StoreSaleReturnRequest;
use App\Models\Sale;
use App\Services\Sales\SaleReturnService;

class SaleReturnController extends Controller
{
    public function __construct(private SaleReturnService $service) {}

    public function store(StoreSaleReturnRequest $request, Sale $sale)
    {
        $return = $this->service->create(
            $sale,
            $request->validated('items'),
            $request->validated('refund_payment_method_id'),
            $request->validated('reason'),
            $request->user(),
        );

        return response()->json($return, 201);
    }
}
