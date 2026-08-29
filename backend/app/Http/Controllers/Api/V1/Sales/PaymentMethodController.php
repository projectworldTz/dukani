<?php

namespace App\Http\Controllers\Api\V1\Sales;

use App\Http\Controllers\Controller;
use App\Models\PaymentMethod;
use App\Support\Tenancy\BusinessContext;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PaymentMethodController extends Controller
{
    public function index()
    {
        return PaymentMethod::where('is_active', true)->orderBy('name')->get();
    }

    public function store(Request $request)
    {
        abort_unless($request->user()->can('business.settings.manage'), 403);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'type' => ['required', Rule::in(['cash', 'mobile_money', 'bank_transfer', 'card', 'pos_terminal', 'credit', 'other'])],
        ]);

        $method = PaymentMethod::create([...$data, 'business_id' => BusinessContext::id()]);

        return response()->json($method, 201);
    }

    public function update(Request $request, PaymentMethod $paymentMethod)
    {
        abort_unless($request->user()->can('business.settings.manage'), 403);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $paymentMethod->update($data);

        return $paymentMethod;
    }
}
