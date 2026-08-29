<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Spec §42: a POS client that times out and retries a sale-creation request
        // (flaky connection, not full offline sync) must not create a duplicate sale.
        // The frontend generates one client-side key per checkout attempt and resends
        // the same key on retry; SaleService returns the existing sale instead of
        // creating a second one when it sees a key it's already processed.
        Schema::table('sales', function (Blueprint $table) {
            $table->string('idempotency_key')->nullable()->after('receipt_verification_token');
            $table->unique(['business_id', 'idempotency_key']);
        });
    }

    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->dropUnique(['business_id', 'idempotency_key']);
            $table->dropColumn('idempotency_key');
        });
    }
};
