<?php

namespace App\Models;

use App\Models\Concerns\BelongsToBusiness;
use Illuminate\Database\Eloquent\Model;

class Unit extends Model
{
    use BelongsToBusiness;

    protected $fillable = ['business_id', 'name', 'short_name'];
}
