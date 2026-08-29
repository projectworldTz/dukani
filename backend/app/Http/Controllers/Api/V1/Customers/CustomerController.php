<?php

namespace App\Http\Controllers\Api\V1\Customers;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customers\RecordCustomerPaymentRequest;
use App\Http\Requests\Customers\StoreCustomerRequest;
use App\Models\Customer;
use App\Models\Sale;
use App\Services\Customers\CustomerService;
use App\Support\Tenancy\BusinessContext;
use Illuminate\Http\Request;

class CustomerController extends Controller
{
    public function __construct(private CustomerService $service) {}

    public function index(Request $request)
    {
        return Customer::orderBy('name')
            ->when($request->filled('search'), fn ($q) => $q->where('name', 'like', '%'.$request->string('search').'%')
                ->orWhere('phone', 'like', '%'.$request->string('search').'%'))
            ->get()
            ->map(fn (Customer $c) => [...$c->toArray(), 'outstanding_balance' => $c->outstandingBalance()]);
    }

    public function store(StoreCustomerRequest $request)
    {
        $customer = Customer::create(['business_id' => BusinessContext::id(), ...$request->validated()]);

        return response()->json($customer, 201);
    }

    public function show(Customer $customer)
    {
        return [
            ...$customer->toArray(),
            'outstanding_balance' => $customer->outstandingBalance(),
            'available_credit' => $customer->availableCredit(),
            'sales' => $customer->sales()->orderByDesc('created_at')->get(['id', 'receipt_number', 'status', 'grand_total', 'amount_paid', 'created_at']),
            'payments' => $customer->payments()->orderByDesc('created_at')->get(['id', 'sale_id', 'amount', 'created_at']),
            'loyalty_transactions' => $customer->loyaltyTransactions()->orderByDesc('created_at')->get(['id', 'type', 'points', 'notes', 'created_at']),
        ];
    }

    public function update(StoreCustomerRequest $request, Customer $customer)
    {
        $customer->update($request->validated());

        return $customer;
    }

    public function recordPayment(RecordCustomerPaymentRequest $request, Customer $customer)
    {
        $sale = Sale::findOrFail($request->validated('sale_id'));

        $payment = $this->service->recordPayment(
            $customer,
            $sale,
            (float) $request->validated('amount'),
            $request->validated('payment_method_id'),
            $request->validated('reference'),
            $request->user(),
        );

        return response()->json($payment, 201);
    }
}
