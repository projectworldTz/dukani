<?php

namespace App\Services\Platform;

use App\Mail\NewClientRegisteredMail;
use App\Models\Business;
use App\Models\User;
use App\Services\Notifications\SmsSender;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Tells the platform owner about every new registration — by email and SMS — so they
 * can call the client and negotiate a subscription. Each channel fails on its own:
 * a bad SMS key never stops the email, and neither can ever break a registration.
 */
class NewClientAlert
{
    public function __construct(private SmsSender $sms) {}

    public function send(Business $business, User $owner): void
    {
        $alerts = config('dukani.alerts');

        foreach ($alerts['emails'] ?? [] as $email) {
            try {
                Mail::to($email)->send(new NewClientRegisteredMail($business, $owner));
            } catch (\Throwable $e) {
                Log::warning("New-client alert email to {$email} failed: {$e->getMessage()}");
            }
        }

        $text = $this->smsText($business, $owner);
        foreach ($alerts['phones'] ?? [] as $phone) {
            try {
                $this->sms->send($phone, $text);
            } catch (\Throwable $e) {
                Log::warning("New-client alert SMS to {$phone} failed: {$e->getMessage()}");
            }
        }
    }

    public function smsText(Business $business, User $owner): string
    {
        $parts = [
            'DUKANI: New client registered!',
            $business->name.($business->category ? " ({$business->category})" : ''),
            'Owner: '.$owner->name,
            $owner->phone ? 'Tel: '.$owner->phone : null,
            'Email: '.$owner->email,
            $business->license_expires_at ? 'Trial ends '.$business->license_expires_at->format('d M Y') : null,
            'Contact them to negotiate.',
        ];

        return implode("\n", array_filter($parts));
    }
}
