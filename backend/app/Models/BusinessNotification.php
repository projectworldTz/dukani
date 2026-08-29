<?php

namespace App\Models;

use App\Models\Concerns\BelongsToBusiness;
use Illuminate\Database\Eloquent\Model;

class BusinessNotification extends Model
{
    use BelongsToBusiness;

    protected $fillable = ['business_id', 'type', 'title', 'message', 'read_at'];

    protected function casts(): array
    {
        return ['read_at' => 'datetime'];
    }
}
