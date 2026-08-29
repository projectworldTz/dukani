<?php

namespace App\Http\Controllers\Api\V1\Products;

use App\Http\Controllers\Controller;
use App\Models\Supplier;
use App\Support\Tenancy\BusinessContext;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class SupplierController extends Controller
{
    public function index()
    {
        return Supplier::orderBy('name')->get()->map(fn (Supplier $s) => [
            ...$s->toArray(),
            'outstanding_balance' => $s->outstandingBalance(),
        ]);
    }

    public function store(Request $request)
    {
        abort_unless($request->user()->can('suppliers.manage'), 403);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'contact_person' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:255'],
            'address' => ['nullable', 'string', 'max:255'],
            'tin' => ['nullable', 'string', 'max:50'],
        ]);
        $supplier = Supplier::create([...$data, 'business_id' => BusinessContext::id()]);

        return response()->json($supplier, 201);
    }

    public function show(Supplier $supplier)
    {
        return [
            ...$supplier->toArray(),
            'outstanding_balance' => $supplier->outstandingBalance(),
            'purchases' => $supplier->purchases()->orderByDesc('created_at')->get(['id', 'purchase_number', 'status', 'grand_total', 'amount_paid', 'created_at']),
            'payments' => $supplier->payments()->orderByDesc('created_at')->get(['id', 'amount', 'reference', 'created_at']),
        ];
    }

    public function update(Request $request, Supplier $supplier)
    {
        abort_unless($request->user()->can('suppliers.manage'), 403);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'contact_person' => ['sometimes', 'nullable', 'string', 'max:255'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:30'],
            'email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'address' => ['sometimes', 'nullable', 'string', 'max:255'],
            'tin' => ['sometimes', 'nullable', 'string', 'max:50'],
        ]);
        $supplier->update($data);

        return $supplier;
    }

    public function destroy(Request $request, Supplier $supplier)
    {
        abort_unless($request->user()->can('suppliers.manage'), 403);

        if ($supplier->purchases()->exists()) {
            throw ValidationException::withMessages(['supplier' => 'This supplier has purchase history and cannot be deleted.']);
        }

        $supplier->delete();

        return response()->json(null, 204);
    }
}
