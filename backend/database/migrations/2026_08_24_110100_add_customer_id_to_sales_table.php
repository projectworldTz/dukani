<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            // customer_name/customer_phone (Phase 1) stay as the point-in-time snapshot;
            // customer_id is the actual relation for credit/loyalty/statements, added
            // now that the Customer module exists. Nullable — walk-in sales have no
            // customer record at all, matching Phase 1's free-text-only behavior.
            $table->foreignId('customer_id')->nullable()->after('customer_phone')->constrained()->nullOnDelete();
            $table->unsignedInteger('loyalty_points_earned')->default(0)->after('change_amount');
            $table->unsignedInteger('loyalty_points_redeemed')->default(0)->after('loyalty_points_earned');
        });
    }

    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->dropConstrainedForeignId('customer_id');
            $table->dropColumn(['loyalty_points_earned', 'loyalty_points_redeemed']);
        });
    }
};
