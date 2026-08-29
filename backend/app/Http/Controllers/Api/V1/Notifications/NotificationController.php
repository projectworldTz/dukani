<?php

namespace App\Http\Controllers\Api\V1\Notifications;

use App\Http\Controllers\Controller;
use App\Models\BusinessNotification;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request)
    {
        return BusinessNotification::when($request->boolean('unread_only'), fn ($q) => $q->whereNull('read_at'))
            ->orderByDesc('created_at')
            ->limit(50)
            ->get();
    }

    public function markRead(BusinessNotification $notification)
    {
        $notification->update(['read_at' => now()]);

        return $notification;
    }

    public function markAllRead(Request $request)
    {
        BusinessNotification::whereNull('read_at')->update(['read_at' => now()]);

        return response()->json(['message' => 'All notifications marked read.']);
    }
}
