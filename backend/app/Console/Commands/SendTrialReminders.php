<?php

namespace App\Console\Commands;

use App\Models\Business;
use App\Models\Scopes\BusinessScope;
use App\Models\User;
use App\Services\Notifications\SmsSender;
use App\Support\Subscription\Subscription;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

/**
 * Texts each trial client once, a couple of days after they registered, reminding
 * them to subscribe. Runs hourly from the scheduler; `trial_reminder_sent_at` makes
 * sure nobody gets it twice. A business without an owner phone is marked as done
 * (there is nobody to text) so it isn't retried every hour.
 */
class SendTrialReminders extends Command
{
    protected $signature = 'dukani:trial-reminders';

    protected $description = 'SMS trial clients a few days after registration asking them to subscribe';

    public function handle(SmsSender $sms): int
    {
        $after = config('dukani.trial_reminder_after_days');
        $sent = 0;

        Business::query()
            ->where('plan', Subscription::TRIAL)
            ->whereNull('trial_reminder_sent_at')
            ->where('created_at', '<=', now()->subDays($after))
            ->where('license_expires_at', '>', now())
            ->where('status', 'active')
            ->orderBy('id')
            ->each(function (Business $business) use ($sms, &$sent) {
                $owner = User::withoutGlobalScope(BusinessScope::class)->find($business->owner_user_id);

                if (! $owner?->phone || SmsSender::normalise($owner->phone) === null) {
                    $business->update(['trial_reminder_sent_at' => now()]);

                    return;
                }

                try {
                    $sms->send($owner->phone, $this->message($business, $owner));
                    $business->update(['trial_reminder_sent_at' => now()]);
                    $sent++;
                } catch (\Throwable $e) {
                    // Left unmarked so the next hourly run tries again.
                    Log::warning("Trial reminder SMS for business {$business->id} failed: {$e->getMessage()}");
                }
            });

        $this->info("Trial reminders sent: {$sent}");

        return self::SUCCESS;
    }

    public function message(Business $business, User $owner): string
    {
        $contact = Subscription::contact();
        $firstName = strtok(trim($owner->name), ' ') ?: $owner->name;
        $days = Subscription::daysLeft($business);
        $ends = $business->license_expires_at->timezone($business->timezone ?: 'Africa/Dar_es_Salaam')->format('d M Y');

        return implode("\n", array_filter([
            "Hello {$firstName}, thank you for choosing Dukani for {$business->name}!",
            "Your free trial ends on {$ends}".($days !== null ? " ({$days} days left)" : '').'. Subscribe now to keep using Dukani without interruption.',
            isset($contact['payment_info']) ? $contact['payment_info'] : null,
            isset($contact['phone']) ? "Call/WhatsApp: {$contact['phone']}" : null,
        ]));
    }
}
