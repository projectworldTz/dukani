<?php

namespace App\Http\Controllers\Api\V1\Expenses;

use App\Http\Controllers\Controller;
use App\Models\Expense;
use App\Support\Tenancy\BusinessContext;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ExpenseController extends Controller
{
    public function index(Request $request)
    {
        abort_unless($request->user()->can('expenses.view') || $request->user()->can('expenses.manage'), 403);

        return Expense::with('category:id,name', 'branch:id,name')
            ->when($request->filled('branch_id'), fn ($q) => $q->where('branch_id', $request->integer('branch_id')))
            ->when($request->filled('category_id'), fn ($q) => $q->where('expense_category_id', $request->integer('category_id')))
            ->when($request->filled('from'), fn ($q) => $q->whereDate('date', '>=', $request->date('from')))
            ->when($request->filled('to'), fn ($q) => $q->whereDate('date', '<=', $request->date('to')))
            ->orderByDesc('date')
            ->paginate($request->integer('per_page', 20));
    }

    public function store(Request $request)
    {
        abort_unless($request->user()->can('expenses.manage'), 403);

        $data = $request->validate([
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
            'expense_category_id' => ['required', 'integer', 'exists:expense_categories,id'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'description' => ['nullable', 'string', 'max:1000'],
            'date' => ['required', 'date'],
            'payment_method_id' => ['nullable', 'integer', 'exists:payment_methods,id'],
            'document' => ['nullable', 'file', 'max:5120'],
        ]);

        $documentPath = null;
        if ($request->hasFile('document')) {
            $documentPath = $request->file('document')->store('expenses/'.BusinessContext::id(), 'public');
        }

        $expense = Expense::create([
            ...$data,
            'business_id' => BusinessContext::id(),
            'document_path' => $documentPath,
            'created_by' => $request->user()->id,
        ]);

        return response()->json($expense->load('category', 'branch'), 201);
    }

    public function show(Expense $expense)
    {
        return $expense->load('category', 'branch', 'paymentMethod');
    }

    public function update(Request $request, Expense $expense)
    {
        abort_unless($request->user()->can('expenses.manage'), 403);

        $data = $request->validate([
            'branch_id' => ['sometimes', 'nullable', 'integer', 'exists:branches,id'],
            'expense_category_id' => ['sometimes', 'integer', 'exists:expense_categories,id'],
            'amount' => ['sometimes', 'numeric', 'min:0.01'],
            'description' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'date' => ['sometimes', 'date'],
            'payment_method_id' => ['sometimes', 'nullable', 'integer', 'exists:payment_methods,id'],
        ]);

        $expense->update($data);

        return $expense->load('category', 'branch');
    }

    public function destroy(Request $request, Expense $expense)
    {
        abort_unless($request->user()->can('expenses.manage'), 403);

        if ($expense->document_path) {
            Storage::disk('public')->delete($expense->document_path);
        }
        $expense->delete();

        return response()->json(null, 204);
    }
}
