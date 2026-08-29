<?php

namespace App\Http\Controllers\Api\V1\Expenses;

use App\Http\Controllers\Controller;
use App\Models\ExpenseCategory;
use App\Support\Tenancy\BusinessContext;
use Illuminate\Http\Request;

class ExpenseCategoryController extends Controller
{
    public function index()
    {
        return ExpenseCategory::orderBy('name')->get();
    }

    public function store(Request $request)
    {
        abort_unless($request->user()->can('expenses.manage'), 403);

        $data = $request->validate(['name' => ['required', 'string', 'max:255']]);

        return response()->json(ExpenseCategory::create([...$data, 'business_id' => BusinessContext::id()]), 201);
    }
}
