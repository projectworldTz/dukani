<?php

return [

    'platform_admin' => [
        'name' => env('PLATFORM_ADMIN_NAME', 'Platform Admin'),
        'email' => env('PLATFORM_ADMIN_EMAIL', 'admin@dukani.test'),
        'password' => env('PLATFORM_ADMIN_PASSWORD', 'ChangeMe123!'),
    ],

    // Adapter endpoint supplied by an approved EFD/VFD integrator. Dukani sends a
    // normalized sale payload and stores the signed fiscal identifiers it returns.
    'efd' => [
        'gateway_url' => env('EFD_GATEWAY_URL'),
        'gateway_token' => env('EFD_GATEWAY_TOKEN'),
        'timeout' => (int) env('EFD_GATEWAY_TIMEOUT', 15),
    ],

];
