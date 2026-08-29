<?php

namespace App\Http\Controllers\Api\V1\Platform;

use App\Http\Controllers\Controller;
use App\Models\PlatformNotification;
use Illuminate\Http\Request;

/**
 * Alerts for the Platform Admin layer itself — e.g. a new business signing up. See
 * App\Models\PlatformNotification's docblock for why this isn't the same table/
 * controller as the tenant-scoped App\Http\Controllers\...\NotificationController.
 */
class PlatformNotificationController extends Controller
{
    private function assertPlatformAdmin(Request $request): void
    {
        abort_unless($request->user()->isPlatformAdmin(), 403, 'Platform Admin access only.');
    }

    public function index(Request $request)
    {
        $this->assertPlatformAdmin($request);

        return PlatformNotification::when($request->boolean('unread_only'), fn ($q) => $q->whereNull('read_at'))
            ->orderByDesc('created_at')
            ->limit(50)
            ->get();
    }

    public function markRead(Request $request, PlatformNotification $notification)
    {
        $this->assertPlatformAdmin($request);

        $notification->update(['read_at' => now()]);

        return $notification;
    }

    public function markAllRead(Request $request)
    {
        $this->assertPlatformAdmin($request);

        PlatformNotification::whereNull('read_at')->update(['read_at' => now()]);

        return response()->json(['message' => 'All notifications marked read.']);
    }
}
