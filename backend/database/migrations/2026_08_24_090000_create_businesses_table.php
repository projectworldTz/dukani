<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('businesses', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            // Nullable: filled in right after the owner User row is created (the two
            // rows are created together inside one DB transaction during registration).
            $table->unsignedBigInteger('owner_user_id')->nullable();
            $table->string('currency', 3)->default('TZS');
            $table->string('timezone')->default('Africa/Dar_es_Salaam');
            $table->string('plan')->nullable();
            $table->enum('status', ['active', 'suspended'])->default('active');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('businesses');
    }
};
