<?php

$list = fn (?string $value) => array_values(array_filter(array_map('trim', explode(',', (string) $value))));

return [

    'platform_admin' => [
        'name' => env('PLATFORM_ADMIN_NAME', 'Platform Admin'),
        'email' => env('PLATFORM_ADMIN_EMAIL', 'admin@dukani.test'),
        'password' => env('PLATFORM_ADMIN_PASSWORD', 'ChangeMe123!'),
    ],

    // Every new business starts on a free trial; when it ends the business is locked
    // until the platform admin extends the license (after payment).
    'trial_days' => (int) env('TRIAL_DAYS', 14),

    // SMS to the client this many days after registering, asking them to subscribe.
    // Sent once by the scheduler (`php artisan dukani:trial-reminders`, hourly).
    'trial_reminder_after_days' => (int) env('TRIAL_REMINDER_AFTER_DAYS', 2),

    // Who hears about every new registration ("contact them to negotiate").
    // Comma-separated; phones in international format, e.g. 255712345678.
    'alerts' => [
        'emails' => $list(env('NEW_CLIENT_ALERT_EMAILS', env('PLATFORM_ADMIN_EMAIL'))),
        'phones' => $list(env('NEW_CLIENT_ALERT_PHONES')),
    ],

    // Shown to clients on the trial banner and the "trial ended" screen.
    'subscription_contact' => [
        'name' => env('SUBSCRIPTION_CONTACT_NAME', 'Dukani Sales'),
        'phone' => env('SUBSCRIPTION_CONTACT_PHONE'),
        'whatsapp' => env('SUBSCRIPTION_CONTACT_WHATSAPP', env('SUBSCRIPTION_CONTACT_PHONE')),
        'email' => env('SUBSCRIPTION_CONTACT_EMAIL'),
        'payment_info' => env('SUBSCRIPTION_PAYMENT_INFO'),
    ],

    // SMS gateway: log (writes to the log only), beem, nextsms or africastalking.
    'sms' => [
        'driver' => env('SMS_DRIVER', 'log'),
        'sender_id' => env('SMS_SENDER_ID', 'INFO'),
        'timeout' => (int) env('SMS_TIMEOUT', 15),
        'beem' => [
            'api_key' => env('BEEM_API_KEY'),
            'secret_key' => env('BEEM_SECRET_KEY'),
        ],
        'nextsms' => [
            'username' => env('NEXTSMS_USERNAME'),
            'password' => env('NEXTSMS_PASSWORD'),
            'url' => env('NEXTSMS_URL', 'https://messaging-service.co.tz/api/sms/v1/text/single'),
        ],
        'africastalking' => [
            'username' => env('AFRICASTALKING_USERNAME'),
            'api_key' => env('AFRICASTALKING_API_KEY'),
        ],
    ],

    // Adapter endpoint supplied by an approved EFD/VFD integrator. Dukani sends a
    // normalized sale payload and stores the signed fiscal identifiers it returns.
    'efd' => [
        'gateway_url' => env('EFD_GATEWAY_URL'),
        'gateway_token' => env('EFD_GATEWAY_TOKEN'),
        'timeout' => (int) env('EFD_GATEWAY_TIMEOUT', 15),
    ],

];
