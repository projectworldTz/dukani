<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Numeric/threshold role settings (e.g. "Manager can approve discounts up to
        // 10%") that don't fit Spatie's boolean permission model. Read alongside the
        // matching boolean permission by the service enforcing the limit (e.g.
        // discount application checks both `sales.discount.apply` and this row's
        // `max_discount_percent`).
        Schema::create('role_limits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_id')->constrained()->cascadeOnDelete();
            $table->foreignId('role_id')->constrained()->cascadeOnDelete();
            $table->string('key');
            $table->decimal('value', 14, 2);
            $table->timestamps();

            $table->unique(['business_id', 'role_id', 'key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('role_limits');
    }
};
