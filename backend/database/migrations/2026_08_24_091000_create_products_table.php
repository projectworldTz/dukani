<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_id')->constrained()->cascadeOnDelete();
            // Encoded into QR codes instead of the sequential id, so scanning a QR never
            // exposes an internal row-count/enumeration signal.
            $table->uuid('uuid')->unique();
            $table->foreignId('category_id')->nullable()->constrained('product_categories')->nullOnDelete();
            $table->foreignId('brand_id')->nullable()->constrained('brands')->nullOnDelete();
            $table->foreignId('unit_id')->nullable()->constrained('units')->nullOnDelete();
            $table->foreignId('supplier_id')->nullable()->constrained('suppliers')->nullOnDelete();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('sku')->nullable();
            $table->string('image_path')->nullable();
            $table->decimal('cost_price', 14, 2)->default(0);
            $table->decimal('selling_price', 14, 2)->default(0);
            $table->decimal('wholesale_price', 14, 2)->nullable();
            $table->decimal('minimum_selling_price', 14, 2)->nullable();
            $table->decimal('tax_rate', 5, 2)->default(0);
            $table->boolean('is_tax_inclusive')->default(false);
            $table->decimal('discount_percent', 5, 2)->nullable();
            $table->integer('reorder_level')->default(0);
            $table->integer('max_stock_level')->nullable();
            $table->string('shelf_location')->nullable();
            $table->boolean('has_expiry')->default(false);
            $table->boolean('has_batch')->default(false);
            $table->boolean('has_serial')->default(false);
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            // Soft-deleted, never hard-deleted: a product referenced by past sale_items
            // (which already snapshot their own name/price/etc.) must stay resolvable.
            $table->softDeletes();

            $table->unique(['business_id', 'sku']);
            $table->index(['business_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
