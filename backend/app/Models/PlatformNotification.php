<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Alerts for the Platform Admin layer (business_id-null users) — e.g. a new business
 * signing up. Deliberately not tenant-scoped, the same way Business itself isn't;
 * BusinessNotification is the tenant-scoped equivalent for regular business users.
 */
class PlatformNotification extends Model
{
    protected $fillable = ['type', 'title', 'message', 'business_id', 'read_at'];

    protected function casts(): array
    {
        return ['read_at' => 'datetime'];
    }

    public function business(): BelongsTo
    {
        return $this->belongsTo(Business::class);
    }
}
