<?php

namespace App\Services\Shifts;

use App\Models\CashierShift;
use App\Models\Payment;
use App\Models\User;
use App\Support\Tenancy\BusinessContext;
use Illuminate\Validation\ValidationException;

class CashierShiftService
{
    public function open(User $user, int $branchId, float $openingCash): CashierShift
    {
        if (CashierShift::where('user_id', $user->id)->where('status', 'open')->exists()) {
            throw ValidationException::withMessages(['shift' => 'You already have an open shift.']);
        }

        return CashierShift::create([
            'business_id' => BusinessContext::id(),
            'branch_id' => $branchId,
            'user_id' => $user->id,
            'opening_cash' => $openingCash,
            'status' => 'open',
            'opened_at' => now(),
        ]);
    }

    public function close(CashierShift $shift, float $closingCash, ?string $notes = null): CashierShift
    {
        if ($shift->status !== 'open') {
            throw ValidationException::withMessages(['shift' => 'This shift is already closed.']);
        }

        // Cash sales rung up during this shift — refunds/manual cash-in/cash-out are
        // later phases (Returns, Cash Drawer logging), so expected cash for now is
        // simply opening float + cash actually collected.
        $cashSales = Payment::whereHas('sale', fn ($q) => $q->where('shift_id', $shift->id)->where('status', 'completed'))
            ->whereHas('paymentMethod', fn ($q) => $q->where('type', 'cash'))
            ->sum('amount');

        $expectedCash = (float) $shift->opening_cash + (float) $cashSales;

        $shift->update([
            'closing_cash' => $closingCash,
            'expected_cash' => $expectedCash,
            'difference' => $closingCash - $expectedCash,
            'status' => 'closed',
            'closed_at' => now(),
            'notes' => $notes,
        ]);

        return $shift;
    }
}
