<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * "Simple mode" is the default for new shops: multi-step workflows (stock transfers,
 * stock taking, purchase orders, quotations, roles, audit log) are hidden from the
 * menu until an owner switches advanced features on in Settings.
 *
 * Existing businesses that already rely on any of those workflows (or run more than
 * one branch) are switched on here so nobody loses a screen they were using.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('business_settings', function (Blueprint $table) {
            $table->boolean('advanced_features')->default(false);
        });

        $businessIds = collect();

        $businessIds = $businessIds->merge(
            DB::table('branches')->select('business_id')->groupBy('business_id')->havingRaw('COUNT(*) > 1')->pluck('business_id')
        );

        foreach (['stock_transfers', 'stock_takes', 'quotations', 'purchase_orders', 'purchases'] as $table) {
            if (Schema::hasTable($table)) {
                $businessIds = $businessIds->merge(DB::table($table)->distinct()->pluck('business_id'));
            }
        }

        $ids = $businessIds->filter()->unique()->values();
        if ($ids->isNotEmpty()) {
            DB::table('business_settings')->whereIn('business_id', $ids)->update(['advanced_features' => true]);
        }
    }

    public function down(): void
    {
        Schema::table('business_settings', function (Blueprint $table) {
            $table->dropColumn('advanced_features');
        });
    }
};
