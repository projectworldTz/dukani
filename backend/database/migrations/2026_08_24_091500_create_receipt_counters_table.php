<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // One row per branch, locked with lockForUpdate() inside the sale-creation
        // transaction to hand out sequential receipt numbers without duplicates/gaps
        // under concurrent cashiers — see App\Services\Sales\ReceiptNumberService.
        Schema::create('receipt_counters', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_id')->constrained()->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('next_number')->default(1);
            $table->timestamps();

            $table->unique(['business_id', 'branch_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('receipt_counters');
    }
};
