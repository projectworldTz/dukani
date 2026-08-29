<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Populated when a purchase is received for a product with has_batch/has_expiry
        // set (spec §19). Tracks remaining quantity per batch for expiry
        // alerting/reporting; NOT wired into sale-time stock consumption in this phase
        // (sales still decrement the aggregate `inventories.quantity` — FIFO batch
        // consumption at checkout is a materially separate project, deferred).
        Schema::create('product_batches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
            $table->string('batch_number');
            $table->date('manufactured_at')->nullable();
            $table->date('expiry_date')->nullable();
            $table->integer('quantity_received');
            $table->integer('quantity_remaining');
            $table->foreignId('purchase_item_id')->nullable()->constrained('purchase_items')->nullOnDelete();
            $table->timestamps();

            $table->unique(['business_id', 'product_id', 'branch_id', 'batch_number'], 'product_batches_business_product_branch_batch_unique');
            $table->index(['business_id', 'expiry_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_batches');
    }
};
