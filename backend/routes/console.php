<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Needs one cron entry on the server (cPanel → Cron Jobs), every minute:
//   cd /home/USER/path/to/dukani/backend && php artisan schedule:run >> /dev/null 2>&1
Schedule::command('dukani:trial-reminders')->hourly()->withoutOverlapping();
