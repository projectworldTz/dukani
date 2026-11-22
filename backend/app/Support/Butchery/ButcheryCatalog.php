<?php

namespace App\Support\Butchery;

use App\Models\Business;

/**
 * Butchery & fresh foods platform. Weighed products store quantities in grams and are
 * priced per kilogram (see the butchery migration for why).
 */
final class ButcheryCatalog
{
    public const CATEGORY = 'Butchery & Fresh Foods';

    /** Grams per kilogram — the divisor between stored quantity and priced unit. */
    public const GRAMS_PER_KG = 1000;

    public const STARTER_CATEGORIES = [
        'Beef', 'Goat', 'Mutton', 'Chicken', 'Fish & Seafood', 'Pork', 'Offal',
        'Sausages & Processed', 'Eggs', 'Vegetables & Fruits', 'Spices & Others',
    ];

    public static function isButchery(?Business $business): bool
    {
        return $business !== null && $business->category === self::CATEGORY;
    }
}
