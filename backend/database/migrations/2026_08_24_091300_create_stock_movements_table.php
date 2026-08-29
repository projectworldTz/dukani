<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Append-only ledger — every inventory change goes through
        // App\Services\Inventory\StockMovementService, which writes one row here for
        // every quantity change (spec's requirement that no stock change be
        // unexplained). Only opening_stock/sale/adjustment are actually produced in
        // Phase 1; the rest of the enum exists now so later phases (Purchases,
        // Returns, Transfers) don't need a migration just to add a movement type.
        Schema::create('stock_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
            $table->integer('previous_quantity');
            $table->integer('quantity_change');
            $table->integer('new_quantity');
            $table->enum('type', [
                'opening_stock', 'sale', 'sale_return', 'purchase', 'purchase_return',
                'adjustment', 'damaged', 'expired', 'lost', 'stolen',
                'transfer_in', 'transfer_out',
            ]);
            $table->string('reference_type')->nullable();
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->text('reason')->nullable();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['business_id', 'product_id', 'branch_id']);
            $table->index(['reference_type', 'reference_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_movements');
    }
};
