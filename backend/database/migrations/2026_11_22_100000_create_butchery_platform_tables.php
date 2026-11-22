<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Butchery & fresh foods platform: products sold by weight, and carcass breakdowns.
 *
 * Weighed products keep every quantity column in WHOLE GRAMS (inventories, stock
 * movements, sale items…), so the existing integer columns stay exact; prices are per
 * kilogram. `sale_items.price_divisor` snapshots the conversion (1000 for weighed lines,
 * 1 otherwise) so reports compute `unit_price × quantity ÷ price_divisor` correctly
 * forever, even if a product is later switched between weighed and counted.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->boolean('sold_by_weight')->default(false)->after('is_controlled');
        });

        Schema::table('sale_items', function (Blueprint $table) {
            $table->unsignedSmallInteger('price_divisor')->default(1)->after('quantity');
        });

        Schema::create('carcass_breakdowns', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_id')->constrained()->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
            $table->string('description');                     // "Goat from Pugu market"
            $table->unsignedInteger('carcass_weight_g');
            $table->decimal('total_cost', 14, 2);
            $table->unsignedInteger('yield_weight_g');        // sum of the cuts
            $table->decimal('cost_per_kg', 14, 2);             // total cost ÷ usable kg
            $table->json('lines');                             // [{product_id, name, weight_g}]
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['business_id', 'created_at']);
        });

        // Existing butcheries switch automatically: starter categories if they have none.
        $ids = DB::table('businesses')->where('category', 'Butchery & Fresh Foods')->pluck('id');
        foreach ($ids as $businessId) {
            if (! DB::table('product_categories')->where('business_id', $businessId)->exists()) {
                $now = now();
                DB::table('product_categories')->insert(array_map(
                    fn ($name) => ['business_id' => $businessId, 'name' => $name, 'parent_id' => null, 'created_at' => $now, 'updated_at' => $now],
                    \App\Support\Butchery\ButcheryCatalog::STARTER_CATEGORIES,
                ));
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('carcass_breakdowns');
        Schema::table('sale_items', fn (Blueprint $table) => $table->dropColumn('price_divisor'));
        Schema::table('products', fn (Blueprint $table) => $table->dropColumn('sold_by_weight'));
    }
};
