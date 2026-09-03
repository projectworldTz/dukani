<?php

namespace App\Http\Controllers\Api\V1\Quotations;

use App\Http\Controllers\Controller;
use App\Http\Requests\Quotations\StoreQuotationRequest;
use App\Http\Requests\Quotations\UpdateQuotationRequest;
use App\Models\Quotation;
use App\Services\Quotations\QuotationService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class QuotationController extends Controller
{
    public function __construct(private QuotationService $service) {}

    public function index(Request $request)
    {
        abort_unless($request->user()->can('quotations.manage'), 403);

        return Quotation::with('customer:id,name', 'branch:id,name')
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->orderByDesc('created_at')
            ->paginate(min(max($request->integer('per_page', 20), 1), 100));
    }

    public function store(StoreQuotationRequest $request)
    {
        $quotation = $this->service->create($request->validated(), $request->validated('items'), $request->user());

        return response()->json($quotation, 201);
    }

    public function show(Quotation $quotation)
    {
        return $quotation->load('items.product:id,name,sku', 'customer', 'branch', 'convertedSale:id,receipt_number');
    }

    public function update(UpdateQuotationRequest $request, Quotation $quotation)
    {
        $quotation = $this->service->update($quotation, $request->validated(), $request->validated('items'), $request->user());

        return response()->json($quotation);
    }

    public function duplicate(Request $request, Quotation $quotation)
    {
        abort_unless($request->user()->can('quotations.manage'), 403);

        $copy = $this->service->duplicate($quotation, $request->user());

        return response()->json($copy, 201);
    }

    public function pdf(Request $request, Quotation $quotation)
    {
        abort_unless($request->user()->can('quotations.manage'), 403);

        $quotation->load('items', 'customer', 'branch');
        $business = $request->user()->business;

        $pdf = Pdf::loadView('quotations.quotation', [
            'quotation' => $quotation,
            'business' => $business,
            'settings' => $business->settings,
        ]);
        $pdf->setPaper('a4', 'portrait');

        return $pdf->stream("{$quotation->quotation_number}.pdf");
    }

    public function updateStatus(Request $request, Quotation $quotation)
    {
        abort_unless($request->user()->can('quotations.manage'), 403);

        $data = $request->validate(['status' => ['required', Rule::in(['sent', 'accepted', 'rejected', 'expired'])]]);

        return $this->service->updateStatus($quotation, $data['status']);
    }

    public function convert(Request $request, Quotation $quotation)
    {
        abort_unless($request->user()->can('quotations.manage') && $request->user()->can('sales.create'), 403);

        $sale = $this->service->convertToSale($quotation, $request->user());

        return response()->json($sale, 201);
    }
}
