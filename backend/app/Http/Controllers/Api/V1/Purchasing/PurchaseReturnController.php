<?php

namespace App\Http\Controllers\Api\V1\Purchasing;

use App\Http\Controllers\Controller;
use App\Http\Requests\Purchasing\StorePurchaseReturnRequest;
use App\Models\Purchase;
use App\Services\Purchasing\PurchaseReturnService;

class PurchaseReturnController extends Controller
{
    public function __construct(private PurchaseReturnService $service) {}

    public function store(StorePurchaseReturnRequest $request, Purchase $purchase)
    {
        $return = $this->service->create($purchase, $request->validated('items'), $request->validated('reason'), $request->user());

        return response()->json($return, 201);
    }
}
