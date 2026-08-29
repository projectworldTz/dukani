<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Named business_notifications (not notifications) to avoid colliding with
        // Laravel's own Notifiable trait/notifications schema — User already uses
        // Notifiable, whose notifications() relation expects a different table shape
        // (notifiable_type/id, uuid, data json). Generated inline at the moment
        // something notification-worthy happens (e.g. a stock movement that drops a
        // product to/below its reorder level) rather than via a scheduled job — no
        // queue worker infrastructure assumed yet, and these are all triggered by an
        // action that's already happening synchronously.
        Schema::create('business_notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_id')->constrained()->cascadeOnDelete();
            $table->string('type');
            $table->string('title');
            $table->text('message');
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->index(['business_id', 'read_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('business_notifications');
    }
};
