<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // A product can carry more than one barcode (manufacturer + internally
        // generated, or multiple pack sizes) — one row per code, one flagged primary.
        Schema::create('barcodes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->string('code');
            $table->enum('type', ['EAN13', 'EAN8', 'UPCA', 'UPCE', 'CODE128', 'INTERNAL']);
            $table->boolean('is_primary')->default(false);
            $table->timestamps();

            // Scoped to business, not global: two independent shops may legitimately
            // scan the same manufacturer barcode for their own (different) products.
            $table->unique(['business_id', 'code']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('barcodes');
    }
};
