<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Deliberately NOT business-scoped (no BelongsToBusiness) — these are alerts for
        // the Platform Admin layer itself (business_id null users), the same way the
        // Business model's own registry table isn't tenant-scoped either.
        Schema::create('platform_notifications', function (Blueprint $table) {
            $table->id();
            $table->string('type');
            $table->string('title');
            $table->text('message');
            $table->foreignId('business_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('platform_notifications');
    }
};
