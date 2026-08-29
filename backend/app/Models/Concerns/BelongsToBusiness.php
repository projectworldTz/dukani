<?php

namespace App\Models\Concerns;

use App\Models\Business;
use App\Models\Scopes\BusinessScope;
use App\Support\Tenancy\BusinessContext;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * The primary tenant-isolation mechanism for this model — see BusinessScope and
 * App\Support\Tenancy\BusinessContext for the exact rules (deny-by-default when no
 * business is set, explicit BusinessContext::runAsPlatform() opt-in for legitimate
 * cross-business Platform Admin operations).
 *
 * @mixin Model
 * @property int|string|null $business_id
 */
trait BelongsToBusiness
{
    public static function bootBelongsToBusiness(): void
    {
        static::addGlobalScope(new BusinessScope);

        static::creating(function (Model $model) {
            if (! $model->business_id && BusinessContext::check()) {
                $model->business_id = BusinessContext::id();
            }
        });
    }

    public function business(): BelongsTo
    {
        return $this->belongsTo(Business::class);
    }
}
