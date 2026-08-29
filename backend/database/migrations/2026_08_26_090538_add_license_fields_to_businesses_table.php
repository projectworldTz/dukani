<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('businesses', function (Blueprint $table) {
            // Null means "no license term set" (e.g. legacy/free businesses) rather than "expired".
            $table->timestamp('license_expires_at')->nullable()->after('plan');
            // Set the moment the "1 month left" notification is sent, so login doesn't
            // re-notify on every subsequent request; cleared whenever the license is
            // extended so the next expiry cycle can alert again.
            $table->timestamp('license_expiry_alerted_at')->nullable()->after('license_expires_at');
        });
    }

    public function down(): void
    {
        Schema::table('businesses', function (Blueprint $table) {
            $table->dropColumn(['license_expires_at', 'license_expiry_alerted_at']);
        });
    }
};
