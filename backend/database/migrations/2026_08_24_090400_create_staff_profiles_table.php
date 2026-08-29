<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('staff_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            // Nullable: a Business Owner (or a Manager with cross-branch access) isn't
            // pinned to one branch. A branch-scoped role (Cashier/Storekeeper) requires
            // one, enforced in the service layer, not the schema.
            $table->foreignId('branch_id')->nullable()->constrained()->nullOnDelete();
            // Descriptive only — permissions come from assigned Spatie roles, not this.
            $table->string('job_title')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('staff_profiles');
    }
};
