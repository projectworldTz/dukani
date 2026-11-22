<?php

namespace App\Support\Subscription;

use App\Models\Business;

/**
 * Trial / paid status of a business, derived from `plan` and `license_expires_at`.
 * A business with no expiry date (registered before trials existed) is unlimited.
 */
final class Subscription
{
    public const TRIAL = 'trial';

    public const PAID = 'paid';

    public static function isExpired(?Business $business): bool
    {
        return (bool) $business?->license_expires_at?->isPast();
    }

    public static function isTrial(?Business $business): bool
    {
        return $business?->plan === self::TRIAL;
    }

    /** Whole days left (0 on the last day), or null when there is no expiry. */
    public static function daysLeft(?Business $business): ?int
    {
        $expires = $business?->license_expires_at;
        if (! $expires) {
            return null;
        }

        return $expires->isPast() ? 0 : (int) floor(now()->diffInSeconds($expires) / 86400);
    }

    /** Who to call / how to pay — shown on the trial banner and the "trial ended" screen. */
    public static function contact(): array
    {
        return array_filter(config('dukani.subscription_contact'), fn ($v) => filled($v));
    }

    public static function summary(?Business $business): array
    {
        return [
            'plan' => $business?->plan,
            'is_trial' => self::isTrial($business),
            'expires_at' => $business?->license_expires_at?->toIso8601String(),
            'days_left' => self::daysLeft($business),
            'is_expired' => self::isExpired($business),
            'contact' => self::contact(),
        ];
    }

    /** The message a locked-out user sees, with how to reach you. */
    public static function expiredMessage(?Business $business): string
    {
        $contact = self::contact();
        $how = collect([
            isset($contact['phone']) ? "call {$contact['phone']}" : null,
            isset($contact['whatsapp']) && ($contact['whatsapp'] !== ($contact['phone'] ?? null)) ? "WhatsApp {$contact['whatsapp']}" : null,
            isset($contact['email']) ? "email {$contact['email']}" : null,
        ])->filter()->join(', ', ' or ');

        $lead = self::isTrial($business)
            ? 'Your '.config('dukani.trial_days').'-day free trial has ended.'
            : 'Your Dukani subscription has expired.';

        return trim($lead.' To continue using Dukani, please subscribe'.($how ? " — {$how}" : '').'.');
    }
}
