<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sale_return_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_id')->constrained()->cascadeOnDelete();
            $table->foreignId('sale_return_id')->constrained()->cascadeOnDelete();
            $table->foreignId('sale_item_id')->constrained()->restrictOnDelete();
            $table->foreignId('product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->integer('quantity');
            $table->decimal('unit_price', 14, 2);
            $table->decimal('line_total', 14, 2);
            // sellable: goes back into `inventories.quantity` (stock_movements
            // type=sale_return). damaged: stays out of sellable stock entirely — no
            // movement row, since the sellable count never changes (spec §25).
            $table->enum('condition', ['sellable', 'damaged'])->default('sellable');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sale_return_items');
    }
};
