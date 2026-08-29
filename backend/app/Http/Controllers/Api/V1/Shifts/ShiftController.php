<?php

namespace App\Http\Controllers\Api\V1\Shifts;

use App\Http\Controllers\Controller;
use App\Http\Requests\Shifts\CloseShiftRequest;
use App\Http\Requests\Shifts\OpenShiftRequest;
use App\Models\CashierShift;
use App\Services\Shifts\CashierShiftService;
use Illuminate\Http\Request;

class ShiftController extends Controller
{
    public function __construct(private CashierShiftService $shiftService) {}

    public function current(Request $request)
    {
        $shift = CashierShift::where('user_id', $request->user()->id)->where('status', 'open')->first();

        return $shift ?? response()->json(null);
    }

    public function open(OpenShiftRequest $request)
    {
        $shift = $this->shiftService->open($request->user(), $request->validated('branch_id'), $request->validated('opening_cash'));

        return response()->json($shift, 201);
    }

    public function close(CloseShiftRequest $request, CashierShift $cashierShift)
    {
        $closed = $this->shiftService->close($cashierShift, $request->validated('closing_cash'), $request->validated('notes'));

        return $closed;
    }

    public function index(Request $request)
    {
        abort_unless($request->user()->can('shifts.view.all'), 403);

        return CashierShift::with('user:id,name', 'branch:id,name')
            ->when($request->filled('branch_id'), fn ($q) => $q->where('branch_id', $request->integer('branch_id')))
            ->orderByDesc('opened_at')
            ->paginate($request->integer('per_page', 20));
    }
}
