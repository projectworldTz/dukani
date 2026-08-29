<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Written by App\Services\Audit\AuditLogger. Phase 1 logs a handful of
        // sensitive actions (login, sale creation, receipt reprint, manual stock
        // adjustment, permission changes) — full coverage of every sensitive action in
        // the spec expands in later phases as those modules are built, but the table
        // and logger are shared infrastructure, not per-module.
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            // Nullable: a handful of platform-level actions (e.g. business suspension
            // by a Platform Admin) have no business of their own.
            $table->foreignId('business_id')->nullable()->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action');
            $table->string('auditable_type')->nullable();
            $table->unsignedBigInteger('auditable_id')->nullable();
            $table->json('old_values')->nullable();
            $table->json('new_values')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent')->nullable();
            $table->timestamps();

            $table->index(['business_id', 'action']);
            $table->index(['auditable_type', 'auditable_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
