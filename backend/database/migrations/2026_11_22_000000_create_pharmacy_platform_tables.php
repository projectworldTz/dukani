<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Pharmacy platform: medicine details on products, dosage instructions and batch
 * traceability on sale items, prescriptions, and the controlled drugs register.
 * Everything is additive — general (non-pharmacy) businesses are unaffected.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('generic_name')->nullable()->after('name');
            $table->string('strength', 100)->nullable()->after('generic_name');      // "500 mg", "250 mg/5 ml"
            $table->string('dosage_form', 50)->nullable()->after('strength');        // tablet, syrup, injection…
            $table->string('pack_size', 100)->nullable()->after('dosage_form');      // "10 × 10 tablets"
            $table->string('manufacturer')->nullable()->after('pack_size');
            $table->boolean('requires_prescription')->default(false)->after('manufacturer');
            $table->boolean('is_controlled')->default(false)->after('requires_prescription');
            $table->index(['business_id', 'generic_name']);
        });

        Schema::table('sale_items', function (Blueprint $table) {
            $table->string('dosage_instructions')->nullable()->after('line_total');
        });

        // Which batches each sold item came from (FEFO) — needed for recalls and for
        // putting returned medicine back into the right batch.
        Schema::create('sale_item_batches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_id')->constrained()->cascadeOnDelete();
            $table->foreignId('sale_item_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_batch_id')->nullable()->constrained('product_batches')->nullOnDelete();
            $table->string('batch_number')->nullable();   // snapshot; null = stock recorded before batch tracking
            $table->date('expiry_date')->nullable();      // snapshot
            $table->integer('quantity');
            $table->integer('quantity_returned')->default(0);
            $table->timestamps();

            $table->index('sale_item_id');
        });

        Schema::create('prescriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_id')->constrained()->cascadeOnDelete();
            $table->foreignId('sale_id')->constrained()->cascadeOnDelete();
            $table->string('rx_number', 100);
            $table->string('prescriber_name');
            $table->string('prescriber_reg_no', 100)->nullable();
            $table->string('facility')->nullable();
            $table->date('issued_on')->nullable();
            $table->string('patient_name');
            $table->unsignedSmallInteger('patient_age')->nullable();
            $table->string('patient_phone', 30)->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique('sale_id');
            $table->index(['business_id', 'created_at']);
            $table->index(['business_id', 'patient_name']);
        });

        // Controlled drugs register: one line per movement of a controlled medicine, with
        // the running balance — the book a pharmacy inspector asks to see.
        Schema::create('controlled_drug_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_id')->constrained()->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_batch_id')->nullable()->constrained('product_batches')->nullOnDelete();
            $table->string('type', 30);                    // received, dispensed, returned, removed, adjusted
            $table->integer('quantity_in')->default(0);
            $table->integer('quantity_out')->default(0);
            $table->integer('balance_after');
            $table->foreignId('sale_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('prescription_id')->nullable()->constrained()->nullOnDelete();
            $table->string('patient_name')->nullable();
            $table->string('prescriber_name')->nullable();
            $table->string('reference')->nullable();       // receipt / batch number / reason
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['business_id', 'product_id', 'created_at']);
        });

        // Existing pharmacies switch to the pharmacy platform automatically; give their
        // medicines batch/expiry tracking and seed starter categories if they have none.
        $pharmacyIds = DB::table('businesses')->where('category', 'Pharmacy & Health')->pluck('id');
        if ($pharmacyIds->isNotEmpty()) {
            DB::table('products')->whereIn('business_id', $pharmacyIds)->update(['has_batch' => true, 'has_expiry' => true]);
            foreach ($pharmacyIds as $businessId) {
                if (! DB::table('product_categories')->where('business_id', $businessId)->exists()) {
                    $now = now();
                    DB::table('product_categories')->insert(array_map(
                        fn ($name) => ['business_id' => $businessId, 'name' => $name, 'parent_id' => null, 'created_at' => $now, 'updated_at' => $now],
                        \App\Support\Pharmacy\PharmacyCatalog::STARTER_CATEGORIES,
                    ));
                }
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('controlled_drug_entries');
        Schema::dropIfExists('prescriptions');
        Schema::dropIfExists('sale_item_batches');
        Schema::table('sale_items', fn (Blueprint $table) => $table->dropColumn('dosage_instructions'));
        Schema::table('products', function (Blueprint $table) {
            $table->dropIndex(['business_id', 'generic_name']);
            $table->dropColumn(['generic_name', 'strength', 'dosage_form', 'pack_size', 'manufacturer', 'requires_prescription', 'is_controlled']);
        });
    }
};
