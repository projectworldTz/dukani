<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Pharmacy platform: a transfer line remembers which batches (number + expiry) left the
 * source branch, so the receiving branch gets the same batches instead of untracked stock.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stock_transfer_items', function (Blueprint $table) {
            $table->json('batches')->nullable()->after('quantity');
        });
    }

    public function down(): void
    {
        Schema::table('stock_transfer_items', fn (Blueprint $table) => $table->dropColumn('batches'));
    }
};
