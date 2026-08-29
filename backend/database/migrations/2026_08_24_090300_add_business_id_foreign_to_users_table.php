<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreign('business_id')->references('id')->on('businesses')->cascadeOnDelete();
        });

        Schema::table('businesses', function (Blueprint $table) {
            $table->foreign('owner_user_id')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('businesses', function (Blueprint $table) {
            $table->dropForeign(['owner_user_id']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['business_id']);
        });
    }
};
