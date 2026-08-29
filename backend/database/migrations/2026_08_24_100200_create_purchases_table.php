<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // The goods-received / supplier-invoice record. May originate from an approved
        // purchase_order (nullable FK) or be entered directly against a supplier.
        Schema::create('purchases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_id')->constrained()->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
            $table->foreignId('supplier_id')->constrained()->restrictOnDelete();
            $table->foreignId('purchase_order_id')->nullable()->constrained('purchase_orders')->nullOnDelete();
            $table->string('purchase_number');
            // partially_received: some items' quantity_received < quantity_ordered.
            $table->enum('status', ['pending', 'partially_received', 'received', 'cancelled'])->default('pending');
            $table->decimal('subtotal', 14, 2)->default(0);
            $table->decimal('tax_total', 14, 2)->default(0);
            $table->decimal('grand_total', 14, 2)->default(0);
            $table->decimal('amount_paid', 14, 2)->default(0);
            $table->text('notes')->nullable();
            $table->foreignId('received_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('received_at')->nullable();
            $table->timestamps();

            $table->unique(['business_id', 'purchase_number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('purchases');
    }
};
