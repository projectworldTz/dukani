<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
            $table->integer('quantity')->default(0);
            // Null = fall back to the product's own reorder_level; set here to override
            // per branch (a busy branch may want a higher reorder threshold).
            $table->integer('reorder_level')->nullable();
            $table->timestamps();

            $table->unique(['business_id', 'product_id', 'branch_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventories');
    }
};
