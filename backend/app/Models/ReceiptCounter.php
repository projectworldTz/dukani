<?php

namespace App\Models;

use App\Models\Concerns\BelongsToBusiness;
use Illuminate\Database\Eloquent\Model;

class ReceiptCounter extends Model
{
    use BelongsToBusiness;

    protected $fillable = ['business_id', 'branch_id', 'next_number'];
}
