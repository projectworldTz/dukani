<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        User::updateOrCreate(
            ['email' => config('dukani.platform_admin.email')],
            [
                'name' => config('dukani.platform_admin.name'),
                'password' => config('dukani.platform_admin.password'),
                'business_id' => null,
                'status' => 'active',
                'email_verified_at' => now(),
            ]
        );

        $this->call(DemoBusinessSeeder::class);
    }
}
