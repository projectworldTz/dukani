<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** When the "subscribe to keep using Dukani" SMS went to a trial client (sent once). */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('businesses', function (Blueprint $table) {
            $table->timestamp('trial_reminder_sent_at')->nullable()->after('license_expiry_alerted_at');
        });
    }

    public function down(): void
    {
        Schema::table('businesses', fn (Blueprint $table) => $table->dropColumn('trial_reminder_sent_at'));
    }
};
