<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('businesses', function (Blueprint $table) {
            // Freeform, not an enum: the landing page offers common presets (Retail,
            // Restaurant, Pharmacy, ...) plus an "Other" option with custom text, so this
            // POS isn't artificially limited to a fixed list of business types.
            $table->string('category')->nullable()->after('name');
        });
    }

    public function down(): void
    {
        Schema::table('businesses', function (Blueprint $table) {
            $table->dropColumn('category');
        });
    }
};
