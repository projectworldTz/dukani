<?php

namespace App\Services\Customers;

use App\Models\Customer;
use App\Models\CustomerPayment;
use App\Models\Sale;
use App\Models\User;
use App\Support\Tenancy\BusinessContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CustomerService
{
    /** A payment always applies against one specific sale (mirrors SupplierPayment). */
    public function recordPayment(Customer $customer, Sale $sale, float $amount, ?int $paymentMethodId, ?string $reference, User $user): CustomerPayment
    {
        if ($sale->customer_id !== $customer->id) {
            throw ValidationException::withMessages(['sale_id' => 'That sale does not belong to this customer.']);
        }

        $outstanding = round((float) $sale->grand_total - (float) $sale->amount_paid, 2);

        if ($amount <= 0 || $amount > $outstanding) {
            throw ValidationException::withMessages(['amount' => "Amount must be between 0 and the outstanding balance of {$outstanding}."]);
        }

        return DB::transaction(function () use ($customer, $sale, $amount, $paymentMethodId, $reference, $user) {
            $payment = CustomerPayment::create([
                'business_id' => BusinessContext::id(),
                'customer_id' => $customer->id,
                'sale_id' => $sale->id,
                'amount' => $amount,
                'payment_method_id' => $paymentMethodId,
                'reference' => $reference,
                'received_by' => $user->id,
            ]);

            $sale->increment('amount_paid', $amount);

            return $payment;
        });
    }
}
