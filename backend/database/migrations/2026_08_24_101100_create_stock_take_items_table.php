<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_take_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_id')->constrained()->cascadeOnDelete();
            $table->foreignId('stock_take_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            // Snapshotted when the item is added to the count sheet, so a concurrent
            // sale between count-start and approval doesn't silently change the
            // baseline the variance is computed against.
            $table->integer('system_quantity');
            $table->integer('counted_quantity')->nullable();
            $table->timestamps();

            $table->unique(['stock_take_id', 'product_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_take_items');
    }
};
