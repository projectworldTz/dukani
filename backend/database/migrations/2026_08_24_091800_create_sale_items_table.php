<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sale_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_id')->constrained()->cascadeOnDelete();
            $table->foreignId('sale_id')->constrained()->cascadeOnDelete();
            // Nullable + nullOnDelete: this row's own snapshot columns below are the
            // source of truth for historical receipts/reports, per spec §57 — a later
            // product edit (or soft-delete) must never change a past sale's figures.
            $table->foreignId('product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->string('product_name');
            $table->string('sku')->nullable();
            $table->integer('quantity');
            $table->decimal('unit_price', 14, 2);
            $table->decimal('cost_price', 14, 2);
            $table->decimal('discount_amount', 14, 2)->default(0);
            $table->decimal('tax_amount', 14, 2)->default(0);
            $table->decimal('line_total', 14, 2);
            $table->timestamps();

            $table->index('sale_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sale_items');
    }
};
