<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('businesses', function (Blueprint $table) {
            // Set when a platform admin deletes the business, cleared again on restore
            // — so it only ever reflects the reason for the *current* deletion, not a
            // history of every past one (the audit log already covers full history).
            $table->text('deletion_reason')->nullable()->after('deleted_at');
        });
    }

    public function down(): void
    {
        Schema::table('businesses', function (Blueprint $table) {
            $table->dropColumn('deletion_reason');
        });
    }
};
