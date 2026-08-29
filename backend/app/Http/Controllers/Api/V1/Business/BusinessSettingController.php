<?php

namespace App\Http\Controllers\Api\V1\Business;

use App\Http\Controllers\Controller;
use App\Http\Requests\Business\UpdateBusinessSettingRequest;
use Illuminate\Http\Request;

class BusinessSettingController extends Controller
{
    public function show(Request $request)
    {
        $business = $request->user()->business;

        return [
            'business' => $business->only(['id', 'name', 'slug', 'currency', 'timezone', 'status']),
            'settings' => $business->settings,
        ];
    }

    public function update(UpdateBusinessSettingRequest $request)
    {
        $business = $request->user()->business;
        $data = $request->validated();

        if (isset($data['currency'])) {
            $business->update(['currency' => $data['currency']]);
            unset($data['currency']);
        }

        $business->settings()->update($data);

        return [
            'business' => $business->refresh()->only(['id', 'name', 'slug', 'currency', 'timezone', 'status']),
            'settings' => $business->settings,
        ];
    }
}
