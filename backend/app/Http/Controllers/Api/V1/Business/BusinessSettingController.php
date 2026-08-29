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

        $businessAttributes = array_intersect_key($data, array_flip(['name', 'currency']));
        if ($businessAttributes) {
            $business->update($businessAttributes);
            $data = array_diff_key($data, $businessAttributes);
        }

        $business->settings()->update($data);

        return [
            'business' => $business->refresh()->only(['id', 'name', 'slug', 'currency', 'timezone', 'status']),
            'settings' => $business->settings,
        ];
    }
}
