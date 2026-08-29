<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->string('address')->nullable();
            $table->enum('customer_type', ['retail', 'wholesale'])->default('retail');
            $table->decimal('credit_limit', 14, 2)->default(0);
            $table->unsignedInteger('loyalty_points')->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['business_id', 'phone']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customers');
    }
};
