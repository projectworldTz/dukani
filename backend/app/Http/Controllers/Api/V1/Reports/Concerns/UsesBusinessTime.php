<?php

namespace App\Http\Controllers\Api\V1\Reports\Concerns;

use Illuminate\Support\Carbon;

/**
 * Timestamps are stored in UTC, but "today", "this month" and the day a sale belongs
 * to must follow the shop's own clock — a sale rung up at 00:30 in Dar es Salaam
 * (21:30 UTC the day before) is a "today" sale for that shop. Every report converts
 * the business-local day boundaries to exact UTC instants before querying, and
 * buckets rows into local dates in PHP (portable across SQLite and Postgres).
 */
trait UsesBusinessTime
{
    private ?string $businessTimezone = null;

    protected function tz(): string
    {
        return $this->businessTimezone ??= (request()->user()?->business?->timezone ?: config('app.timezone', 'UTC'));
    }

    /** "Now" on the shop's clock. */
    protected function localNow(): Carbon
    {
        return Carbon::now($this->tz());
    }

    /** A user-supplied date (YYYY-MM-DD) interpreted on the shop's clock, or the fallback. */
    protected function localDate(?string $value, Carbon $fallback): Carbon
    {
        return $value ? Carbon::parse($value, $this->tz()) : $fallback;
    }

    /** Start of the given local day as a UTC instant, for comparing with stored timestamps. */
    protected function utcStart(Carbon $localDay): Carbon
    {
        return $localDay->copy()->setTimezone($this->tz())->startOfDay()->utc();
    }

    /** End of the given local day as a UTC instant. */
    protected function utcEnd(Carbon $localDay): Carbon
    {
        return $localDay->copy()->setTimezone($this->tz())->endOfDay()->utc();
    }

    /** The shop-local calendar date (Y-m-d) of a stored UTC timestamp. */
    protected function localDayOf(mixed $utcTimestamp): string
    {
        return Carbon::parse($utcTimestamp, 'UTC')->setTimezone($this->tz())->toDateString();
    }
}
