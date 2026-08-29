<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // One sale can have multiple rows here (split/mixed payment, spec §11).
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_id')->constrained()->cascadeOnDelete();
            $table->foreignId('sale_id')->constrained()->cascadeOnDelete();
            $table->foreignId('payment_method_id')->constrained()->restrictOnDelete();
            $table->decimal('amount', 14, 2);
            // Free-text external transaction reference — structured for a future
            // provider integration (M-Pesa, Airtel Money, etc.) without one wired up yet.
            $table->string('reference')->nullable();
            $table->foreignId('received_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('sale_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
