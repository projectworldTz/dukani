<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('business_settings', function (Blueprint $table) {
            $table->boolean('efd_enabled')->default(false);
            $table->string('efd_serial')->nullable();
            $table->string('efd_uin')->nullable();
            $table->string('tax_office')->nullable();
            $table->string('receipt_paper_size', 4)->default('80mm');
        });

        Schema::table('sales', function (Blueprint $table) {
            $table->string('fiscal_status')->default('not_required')->index();
            $table->string('fiscal_receipt_number')->nullable();
            $table->string('fiscal_verification_code')->nullable()->index();
            $table->string('fiscal_verification_url')->nullable();
            $table->string('fiscal_z_number')->nullable();
            $table->timestamp('fiscalized_at')->nullable();
            $table->text('fiscal_error')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->dropColumn(['fiscal_status', 'fiscal_receipt_number', 'fiscal_verification_code', 'fiscal_verification_url', 'fiscal_z_number', 'fiscalized_at', 'fiscal_error']);
        });
        Schema::table('business_settings', function (Blueprint $table) {
            $table->dropColumn(['efd_enabled', 'efd_serial', 'efd_uin', 'tax_office', 'receipt_paper_size']);
        });
    }
};
