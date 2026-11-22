<?php

namespace App\Support\Pharmacy;

use App\Models\Business;

/**
 * Which businesses run on the pharmacy platform, plus the fixed lists the pharmacy
 * screens use. A business is a pharmacy when it registered under the
 * "Pharmacy & Health" category — derived, not stored, so existing pharmacies switch
 * automatically and changing the category switches the platform.
 */
final class PharmacyCatalog
{
    public const CATEGORY = 'Pharmacy & Health';

    public const DOSAGE_FORMS = [
        'tablet', 'capsule', 'syrup', 'suspension', 'injection', 'cream', 'ointment',
        'drops', 'inhaler', 'suppository', 'powder', 'sachet', 'gel', 'lotion', 'spray', 'device', 'other',
    ];

    public const STARTER_CATEGORIES = [
        'Antibiotics', 'Pain & Fever', 'Antimalarials', 'Cough, Cold & Flu', 'Vitamins & Supplements',
        'Stomach & Digestion', 'Blood Pressure & Heart', 'Diabetes', 'Skin Care', 'Eye & Ear',
        'Mother & Baby', 'First Aid & Devices', 'Family Planning', 'Personal Care',
    ];

    public static function isPharmacy(?Business $business): bool
    {
        return $business !== null && $business->category === self::CATEGORY;
    }
}
