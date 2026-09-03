<?php

namespace App\Models;

use App\Models\Concerns\BelongsToBusiness;
use Illuminate\Database\Eloquent\Model;

class BusinessSetting extends Model
{
    use BelongsToBusiness;

    protected $fillable = [
        'business_id',
        'address',
        'phone',
        'email',
        'tin',
        'vrn',
        'logo_path',
        'tax_inclusive_pricing',
        'default_tax_rate',
        'receipt_footer_text',
        'loyalty_enabled',
        'loyalty_spend_per_point',
        'loyalty_point_value',
        'efd_enabled',
        'efd_serial',
        'efd_uin',
        'tax_office',
        'receipt_paper_size',
    ];

    protected function casts(): array
    {
        return [
            'tax_inclusive_pricing' => 'boolean',
            'default_tax_rate' => 'decimal:2',
            'loyalty_enabled' => 'boolean',
            'loyalty_spend_per_point' => 'decimal:2',
            'loyalty_point_value' => 'decimal:2',
            'efd_enabled' => 'boolean',
        ];
    }
}
