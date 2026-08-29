<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Business-configurable list (spec: "do not hard-code any payment provider").
        // `type` is a small fixed category so code can still branch on cash-vs-not
        // (e.g. change calculation only applies to cash); `name` is the free-text label
        // a business sets, e.g. "M-Pesa", "Airtel Money", "CRDB Bank Transfer".
        Schema::create('payment_methods', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->enum('type', [
                'cash', 'mobile_money', 'bank_transfer', 'card', 'pos_terminal', 'credit', 'other',
            ]);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['business_id', 'name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_methods');
    }
};
