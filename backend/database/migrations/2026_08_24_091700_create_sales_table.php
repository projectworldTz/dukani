<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sales', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_id')->constrained()->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
            $table->foreignId('cashier_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('shift_id')->nullable()->constrained('cashier_shifts')->nullOnDelete();
            // Plain free-text for Phase 1 — the full Customer module (Phase 3) will add
            // customer_id and a migration to backfill it from these two columns.
            $table->string('customer_name')->nullable();
            $table->string('customer_phone')->nullable();
            $table->string('receipt_number');
            // held = hold/resume sale (spec §10/§30), not a separate table.
            $table->enum('status', ['held', 'completed', 'refunded', 'partially_refunded', 'cancelled'])->default('held');
            $table->decimal('subtotal', 14, 2)->default(0);
            $table->decimal('discount_total', 14, 2)->default(0);
            $table->decimal('tax_total', 14, 2)->default(0);
            $table->decimal('grand_total', 14, 2)->default(0);
            $table->decimal('amount_paid', 14, 2)->default(0);
            $table->decimal('change_amount', 14, 2)->default(0);
            $table->string('currency', 3);
            $table->text('notes')->nullable();
            // Opaque token encoded into the receipt's QR code, resolved by a public,
            // no-auth verification endpoint that returns only receipt-safe fields —
            // never the internal sale id.
            $table->string('receipt_verification_token')->unique()->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->unique(['business_id', 'receipt_number']);
            $table->index(['business_id', 'branch_id', 'status']);
            $table->index(['business_id', 'cashier_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sales');
    }
};
