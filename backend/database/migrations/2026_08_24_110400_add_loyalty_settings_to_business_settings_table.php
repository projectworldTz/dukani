<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('business_settings', function (Blueprint $table) {
            $table->boolean('loyalty_enabled')->default(false);
            // Example default: 10,000 currency spent = 1 point (spec §24's own example).
            $table->decimal('loyalty_spend_per_point', 14, 2)->default(10000);
            // Currency value of one redeemed point applied as a discount at checkout.
            $table->decimal('loyalty_point_value', 14, 2)->default(0);
        });
    }

    public function down(): void
    {
        Schema::table('business_settings', function (Blueprint $table) {
            $table->dropColumn(['loyalty_enabled', 'loyalty_spend_per_point', 'loyalty_point_value']);
        });
    }
};
