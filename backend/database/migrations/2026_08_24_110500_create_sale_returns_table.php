<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sale_returns', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_id')->constrained()->cascadeOnDelete();
            $table->foreignId('sale_id')->constrained()->cascadeOnDelete();
            $table->string('return_number');
            $table->decimal('total_refund', 14, 2)->default(0);
            $table->foreignId('refund_payment_method_id')->nullable()->constrained('payment_methods')->nullOnDelete();
            $table->text('reason')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['business_id', 'return_number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sale_returns');
    }
};
