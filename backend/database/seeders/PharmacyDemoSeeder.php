<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\Business;
use App\Models\BusinessNotification;
use App\Models\BusinessSetting;
use App\Models\CashierShift;
use App\Models\Customer;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\PaymentMethod;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\Sale;
use App\Models\StaffProfile;
use App\Models\Supplier;
use App\Models\Unit;
use App\Models\User;
use App\Services\Customers\CustomerService;
use App\Services\Pharmacy\PharmacyStockService;
use App\Services\Products\ProductService;
use App\Services\Purchasing\PurchaseOrderService;
use App\Services\Purchasing\PurchaseReturnService;
use App\Services\Purchasing\PurchaseService;
use App\Services\Quotations\QuotationService;
use App\Services\Sales\SaleReturnService;
use App\Services\Sales\SaleService;
use App\Services\Shifts\CashierShiftService;
use App\Services\StockTaking\StockTakeService;
use App\Services\Transfers\StockTransferService;
use App\Support\Pharmacy\PharmacyCatalog;
use App\Support\Tenancy\BusinessContext;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Spatie\Permission\PermissionRegistrar;

/**
 * Fills an EMPTY pharmacy with about five weeks of realistic trading, touching every
 * module: medicines with batches & expiry, suppliers, purchase orders, purchases,
 * supplier payments and returns, daily cashier shifts, cash / mobile / card / credit
 * sales, prescriptions, dosage labels, the controlled drugs register, customer returns,
 * loyalty, customer payments, a branch transfer, a stock take, expired-stock removal,
 * quotations, expenses and notifications.
 *
 * Everything goes through the real services (with the clock moved back in time), so
 * stock, batches, receipts and reports all agree with each other.
 *
 *   SEED_PHARMACY=today-pharamacy php artisan db:seed --class=PharmacyDemoSeeder
 *
 * Without SEED_PHARMACY it picks the newest pharmacy that has no products yet. It
 * refuses to touch a pharmacy that already has products.
 */
class PharmacyDemoSeeder extends Seeder
{
    private const DAYS = 35;

    private Business $business;

    private User $owner;

    private User $cashier;

    private User $pharmacist;

    private User $storekeeper;

    private Branch $main;

    private Branch $second;

    /** @var array<string,int> payment method type => id */
    private array $methods = [];

    /** @var array<string,Product> sku => product */
    private array $products = [];

    /** @var array<string,array> sku => catalogue row */
    private array $catalogue = [];

    /** @var list<Customer> */
    private array $customers = [];

    /** @var list<Sale> */
    private array $sales = [];

    private ?CashierShift $shift = null;

    public function run(): void
    {
        mt_srand(2026);

        $slug = env('SEED_PHARMACY');
        $query = Business::withoutGlobalScopes()->where('category', PharmacyCatalog::CATEGORY);
        $business = $slug
            ? $query->where('slug', $slug)->first()
            : $query->whereNotExists(fn ($q) => $q->select(DB::raw(1))->from('products')->whereColumn('products.business_id', 'businesses.id'))->latest('id')->first();

        if (! $business) {
            throw new RuntimeException($slug ? "No pharmacy with slug '{$slug}'." : 'No empty pharmacy found — register one first or set SEED_PHARMACY.');
        }
        if (Product::withoutGlobalScopes()->where('business_id', $business->id)->exists()) {
            throw new RuntimeException("{$business->name} already has products — this seeder only fills an empty pharmacy.");
        }

        $this->business = $business;
        BusinessContext::set($business->id);
        app(PermissionRegistrar::class)->setPermissionsTeamId($business->id);

        try {
            DB::transaction(fn () => $this->seed());
        } finally {
            Carbon::setTestNow();
            BusinessContext::set(null);
        }

        $this->command?->info("Seeded {$business->name}: ".count($this->products).' medicines, '.count($this->sales).' sales.');
    }

    private function seed(): void
    {
        $realNow = Carbon::now();
        $start = $realNow->copy()->subDays(self::DAYS)->setTime(7, 30);
        Carbon::setTestNow($start);

        $this->setup();
        $this->medicines($realNow);

        // ---- Five weeks of trading, one day at a time.
        for ($d = 1; $d <= self::DAYS; $d++) {
            $day = $realNow->copy()->subDays(self::DAYS - $d);
            $isToday = $d === self::DAYS;

            $this->dailyEvents($d, $day, $realNow);
            $this->tradeDay($day, $isToday, $realNow);
        }

        Carbon::setTestNow($realNow);
        $this->afterTrading();
    }

    // ------------------------------------------------------------------ setup

    private function setup(): void
    {
        $b = $this->business;
        $this->owner = User::withoutGlobalScopes()->findOrFail($b->owner_user_id);
        $this->main = Branch::where('business_id', $b->id)->orderByDesc('is_main')->orderBy('id')->firstOrFail();
        $this->second = Branch::firstOrCreate(
            ['business_id' => $b->id, 'code' => 'MBZ'],
            ['name' => 'Mbezi Beach Branch', 'is_main' => false, 'status' => 'active', 'address' => 'Mbezi Beach, Bagamoyo Road', 'phone' => '+255 744 610 228'],
        );

        BusinessSetting::where('business_id', $b->id)->update([
            'address' => 'Sinza Mori, Shekilango Road, Dar es Salaam',
            'phone' => '+255 755 318 402',
            'email' => 'info@todaypharmacy.test',
            'tin' => '128-456-907',
            'receipt_footer_text' => 'Get well soon! Medicines once sold are not returnable unless faulty. Pharmacist on duty 8am – 10pm.',
            'loyalty_enabled' => true,
            'loyalty_spend_per_point' => 1000,
            'loyalty_point_value' => 10,
            'advanced_features' => true,
        ]);

        $this->methods = PaymentMethod::where('business_id', $b->id)->pluck('id', 'type')->all();

        $this->cashier = $this->staff('Rehema Mwakyusa', 'rehema@todaypharmacy.test', '+255 713 220 914', 'Cashier', 'Cashier', $this->main);
        $this->pharmacist = $this->staff('Dr. Daudi Massawe', 'daudi@todaypharmacy.test', '+255 754 880 132', 'Manager', 'Pharmacist in Charge', $this->main);
        $this->storekeeper = $this->staff('Joseph Kimaro', 'joseph@todaypharmacy.test', '+255 786 445 071', 'Storekeeper', 'Store Keeper', $this->main);
        $this->staff('Agnes Lukumay', 'agnes@todaypharmacy.test', '+255 767 102 558', 'Cashier', 'Pharmaceutical Technician', $this->second);

        foreach ([
            ['name' => 'Medical Stores Department (MSD)', 'contact_person' => 'Halima Said', 'phone' => '+255 22 286 0890', 'email' => 'orders@msd.example.test', 'address' => 'Keko, Dar es Salaam'],
            ['name' => 'Laborex Tanzania Ltd', 'contact_person' => 'George Mushi', 'phone' => '+255 754 221 400', 'email' => 'sales@laborex.example.test', 'address' => 'Nyerere Road, Dar es Salaam'],
            ['name' => 'Shelys Pharmaceuticals', 'contact_person' => 'Fatma Bakari', 'phone' => '+255 713 500 777', 'email' => 'trade@shelys.example.test', 'address' => 'Mikocheni Industrial Area'],
            ['name' => 'Salama Pharma Wholesale', 'contact_person' => 'Hamisi Mrisho', 'phone' => '+255 784 330 912', 'email' => 'salama@salamapharma.example.test', 'address' => 'Kariakoo, Dar es Salaam'],
        ] as $s) {
            Supplier::firstOrCreate(['business_id' => $b->id, 'name' => $s['name']], $s);
        }

        foreach ([['Tablet strip', 'strip'], ['Bottle', 'btl'], ['Box', 'box'], ['Tube', 'tube'], ['Piece', 'pc'], ['Vial', 'vial']] as [$name, $short]) {
            Unit::firstOrCreate(['business_id' => $b->id, 'name' => $name], ['short_name' => $short]);
        }

        foreach ([
            ['name' => 'Amina Juma', 'phone' => '+255 715 330 118', 'email' => 'amina.juma@example.test', 'customer_type' => 'retail'],
            ['name' => 'John Mwita', 'phone' => '+255 786 120 447', 'email' => null, 'customer_type' => 'retail'],
            ['name' => 'Mama Grace Lyimo', 'phone' => '+255 754 902 615', 'email' => null, 'customer_type' => 'retail'],
            ['name' => 'Salim Abdallah', 'phone' => '+255 767 554 290', 'email' => 'salim.a@example.test', 'customer_type' => 'retail'],
            ['name' => 'Neema Mollel', 'phone' => '+255 713 667 301', 'email' => null, 'customer_type' => 'retail'],
            ['name' => 'Sinza Family Clinic', 'phone' => '+255 22 246 1180', 'email' => 'accounts@sinzaclinic.example.test', 'customer_type' => 'wholesale', 'credit_limit' => 1500000, 'notes' => 'Pays monthly. Contact: Sr. Mary.'],
            ['name' => 'Ubungo Day Care Centre', 'phone' => '+255 744 310 662', 'email' => null, 'customer_type' => 'wholesale', 'credit_limit' => 400000],
        ] as $c) {
            $this->customers[] = Customer::firstOrCreate(['business_id' => $b->id, 'phone' => $c['phone']], $c);
        }
    }

    private function staff(string $name, string $email, string $phone, string $role, string $title, Branch $branch): User
    {
        $user = User::withoutGlobalScopes()->firstOrCreate(
            ['email' => $email],
            ['business_id' => $this->business->id, 'name' => $name, 'phone' => $phone, 'password' => 'Staff@2026', 'status' => 'active', 'email_verified_at' => now()],
        );
        $user->syncRoles([$role]);
        StaffProfile::updateOrCreate(
            ['business_id' => $this->business->id, 'user_id' => $user->id],
            ['branch_id' => $branch->id, 'job_title' => $title],
        );

        return $user;
    }

    // ------------------------------------------------------------- medicines

    private function medicines(Carbon $realNow): void
    {
        $exp = fn (int $days) => $realNow->copy()->addDays($days)->toDateString();
        $cat = ProductCategory::where('business_id', $this->business->id)->pluck('id', 'name');
        $unit = Unit::where('business_id', $this->business->id)->pluck('id', 'name');
        $sup = Supplier::where('business_id', $this->business->id)->pluck('id', 'name');

        // sku, name, generic, strength, form, pack, maker, category, unit, supplier, cost, price, rx, ctrl, reorder, weight (how often sold), batches [qty, batch, expiry]
        $rows = [
            ['TP-001', 'Panadol 500mg', 'Paracetamol', '500 mg', 'tablet', '1 strip × 10 tablets', 'GSK', 'Pain & Fever', 'Tablet strip', 'Laborex Tanzania Ltd', 1200, 2000, false, false, 40, 10, [[160, 'PAN2405A', 220], [120, 'PAN2411C', 420]]],
            ['TP-002', 'Paracetamol 500mg (Shelys)', 'Paracetamol', '500 mg', 'tablet', '1 strip × 10 tablets', 'Shelys', 'Pain & Fever', 'Tablet strip', 'Shelys Pharmaceuticals', 300, 500, false, false, 50, 10, [[300, 'SH-PCM-118', 300]]],
            ['TP-003', 'Ibuprofen 400mg', 'Ibuprofen', '400 mg', 'tablet', '1 strip × 10 tablets', 'Zenufa', 'Pain & Fever', 'Tablet strip', 'Salama Pharma Wholesale', 600, 1000, false, false, 30, 7, [[150, 'IBU-7731', 48], [80, 'IBU-8102', 380]]],
            ['TP-004', 'Diclofenac 50mg', 'Diclofenac sodium', '50 mg', 'tablet', '1 strip × 10 tablets', 'Cipla', 'Pain & Fever', 'Tablet strip', 'Laborex Tanzania Ltd', 500, 1000, false, false, 25, 5, [[100, 'DIC-2290', 260]]],
            ['TP-005', 'Amoxicillin 500mg', 'Amoxicillin', '500 mg', 'capsule', '1 strip × 10 capsules', 'Shelys', 'Antibiotics', 'Tablet strip', 'Shelys Pharmaceuticals', 1500, 2500, true, false, 30, 7, [[60, 'AMX-0921', -4], [200, 'AMX-1130', 330]]],
            ['TP-006', 'Augmentin 625mg', 'Amoxicillin + Clavulanic acid', '625 mg', 'tablet', '1 box × 14 tablets', 'GSK', 'Antibiotics', 'Box', 'Laborex Tanzania Ltd', 18000, 26000, true, false, 8, 2, [[30, 'AUG-5521', 400]]],
            ['TP-007', 'Ciprofloxacin 500mg', 'Ciprofloxacin', '500 mg', 'tablet', '1 strip × 10 tablets', 'Cipla', 'Antibiotics', 'Tablet strip', 'Salama Pharma Wholesale', 1200, 2500, true, false, 20, 3, [[80, 'CIP-3381', 75]]],
            ['TP-008', 'Metronidazole 200mg', 'Metronidazole', '200 mg', 'tablet', '1 strip × 10 tablets', 'Shelys', 'Antibiotics', 'Tablet strip', 'Shelys Pharmaceuticals', 300, 600, true, false, 30, 4, [[150, 'MTZ-6610', 520]]],
            ['TP-009', 'Azithromycin 500mg', 'Azithromycin', '500 mg', 'tablet', '1 box × 3 tablets', 'Pfizer', 'Antibiotics', 'Box', 'Laborex Tanzania Ltd', 3500, 6000, true, false, 10, 2, [[40, 'AZI-1172', 28]]],
            ['TP-010', 'ALU (Coartem) 20/120', 'Artemether + Lumefantrine', '20/120 mg', 'tablet', '1 box × 24 tablets', 'Novartis', 'Antimalarials', 'Box', 'Medical Stores Department (MSD)', 4500, 7000, false, false, 15, 6, [[90, 'ALU-4417', 18], [100, 'ALU-5502', 450]]],
            ['TP-011', 'Duo-Cotecxin', 'Dihydroartemisinin + Piperaquine', '40/320 mg', 'tablet', '1 box × 8 tablets', 'Holley', 'Antimalarials', 'Box', 'Salama Pharma Wholesale', 6000, 9500, false, false, 10, 2, [[40, 'DUO-0815', 600]]],
            ['TP-012', 'Malaria Test Kit (mRDT)', 'Malaria rapid test', null, 'device', '1 test', 'SD Bioline', 'First Aid & Devices', 'Piece', 'Medical Stores Department (MSD)', 800, 2000, false, false, 20, 3, [[100, 'MRDT-221', 240]]],
            ['TP-013', 'Benylin Cough Syrup 100ml', 'Diphenhydramine', '14 mg/5 ml', 'syrup', '1 bottle × 100 ml', 'Johnson & Johnson', 'Cough, Cold & Flu', 'Bottle', 'Laborex Tanzania Ltd', 5500, 8500, false, false, 10, 4, [[50, 'BEN-3301', 55], [30, 'BEN-3390', 410]]],
            ['TP-014', 'Coldcap Capsules', 'Paracetamol + Phenylephrine + Chlorphenamine', null, 'capsule', '1 strip × 10 capsules', 'Zenufa', 'Cough, Cold & Flu', 'Tablet strip', 'Salama Pharma Wholesale', 700, 1500, false, false, 20, 5, [[120, 'CLD-9001', 350]]],
            ['TP-015', 'Cetirizine 10mg', 'Cetirizine', '10 mg', 'tablet', '1 strip × 10 tablets', 'Cipla', 'Cough, Cold & Flu', 'Tablet strip', 'Salama Pharma Wholesale', 400, 1000, false, false, 20, 4, [[100, 'CTZ-5543', 500]]],
            ['TP-016', 'Vitamin C 500mg Effervescent', 'Ascorbic acid', '500 mg', 'tablet', '1 tube × 20 tablets', 'Bayer', 'Vitamins & Supplements', 'Tube', 'Laborex Tanzania Ltd', 4000, 6500, false, false, 10, 3, [[45, 'VTC-1188', 370]]],
            ['TP-017', 'Multivitamin Syrup 200ml', 'Multivitamin', null, 'syrup', '1 bottle × 200 ml', 'Shelys', 'Vitamins & Supplements', 'Bottle', 'Shelys Pharmaceuticals', 3000, 5000, false, false, 8, 2, [[30, 'MVS-2201', 90]]],
            ['TP-018', 'ORS Sachets', 'Oral rehydration salts', '20.5 g', 'sachet', '1 sachet', 'MSD', 'Stomach & Digestion', 'Piece', 'Medical Stores Department (MSD)', 200, 500, false, false, 40, 6, [[300, 'ORS-7710', 600]]],
            ['TP-019', 'Omeprazole 20mg', 'Omeprazole', '20 mg', 'capsule', '1 strip × 10 capsules', 'Cipla', 'Stomach & Digestion', 'Tablet strip', 'Salama Pharma Wholesale', 800, 1500, false, false, 20, 4, [[120, 'OME-4410', 280]]],
            ['TP-020', 'Relcer Gel 180ml', 'Antacid', null, 'suspension', '1 bottle × 180 ml', 'Zenufa', 'Stomach & Digestion', 'Bottle', 'Salama Pharma Wholesale', 4500, 7000, false, false, 8, 2, [[25, 'RLC-0912', 15]]],
            ['TP-021', 'Amlodipine 5mg', 'Amlodipine', '5 mg', 'tablet', '1 strip × 10 tablets', 'Cipla', 'Blood Pressure & Heart', 'Tablet strip', 'Laborex Tanzania Ltd', 500, 1200, true, false, 20, 3, [[120, 'AML-3321', 540]]],
            ['TP-022', 'Metformin 500mg', 'Metformin', '500 mg', 'tablet', '1 strip × 10 tablets', 'Shelys', 'Diabetes', 'Tablet strip', 'Shelys Pharmaceuticals', 400, 1000, true, false, 20, 3, [[140, 'MET-6650', 610]]],
            ['TP-023', 'Glucometer Test Strips (50)', 'Blood glucose strips', null, 'device', '1 box × 50 strips', 'Accu-Chek', 'Diabetes', 'Box', 'Laborex Tanzania Ltd', 28000, 38000, false, false, 3, 1, [[8, 'ACC-1002', 200]]],
            ['TP-024', 'Hydrocortisone Cream 1%', 'Hydrocortisone', '1%', 'cream', '1 tube × 15 g', 'Shelys', 'Skin Care', 'Tube', 'Shelys Pharmaceuticals', 1500, 3000, false, false, 10, 2, [[40, 'HYC-2290', 390]]],
            ['TP-025', 'Gentamicin Eye Drops', 'Gentamicin', '0.3%', 'drops', '1 bottle × 10 ml', 'Laborate', 'Eye & Ear', 'Bottle', 'Salama Pharma Wholesale', 1500, 3000, true, false, 6, 1, [[20, 'GEN-0417', -9], [15, 'GEN-0520', 300]]],
            ['TP-026', 'Folic Acid + Iron (Ranferon)', 'Ferrous sulphate + Folic acid', null, 'capsule', '1 strip × 10 capsules', 'Ranbaxy', 'Mother & Baby', 'Tablet strip', 'Laborex Tanzania Ltd', 1500, 3000, false, false, 15, 3, [[80, 'RAN-8810', 430]]],
            ['TP-027', 'Gloves Examination (Box 100)', 'Latex examination gloves', null, 'device', '1 box × 100', 'Medisafe', 'First Aid & Devices', 'Box', 'Medical Stores Department (MSD)', 9000, 14000, false, false, 5, 1, [[20, 'GLV-5001', 900]]],
            ['TP-028', 'Bandage Crepe 10cm', 'Crepe bandage', '10 cm', 'device', '1 roll', 'Medisafe', 'First Aid & Devices', 'Piece', 'Medical Stores Department (MSD)', 900, 2000, false, false, 10, 2, [[40, 'BND-1020', 1200]]],
            ['TP-029', 'Condoms Durex (3)', 'Latex condoms', null, 'device', '1 pack × 3', 'Durex', 'Family Planning', 'Piece', 'Laborex Tanzania Ltd', 2500, 4000, false, false, 10, 3, [[60, 'DRX-7790', 700]]],
            ['TP-030', 'Postinor-2', 'Levonorgestrel', '0.75 mg', 'tablet', '1 strip × 2 tablets', 'Gedeon Richter', 'Family Planning', 'Tablet strip', 'Laborex Tanzania Ltd', 3500, 6000, false, false, 6, 2, [[25, 'PST-3301', 360]]],
            ['TP-031', 'Tramadol 50mg', 'Tramadol hydrochloride', '50 mg', 'capsule', '1 strip × 10 capsules', 'Cipla', 'Pain & Fever', 'Tablet strip', 'Laborex Tanzania Ltd', 1500, 3500, true, true, 10, 2, [[60, 'TRM-2201', 480]]],
            ['TP-032', 'Diazepam 5mg', 'Diazepam', '5 mg', 'tablet', '1 strip × 10 tablets', 'Shelys', 'Pain & Fever', 'Tablet strip', 'Shelys Pharmaceuticals', 600, 1500, true, true, 10, 1, [[40, 'DZP-0911', 550]]],
            ['TP-033', 'Pethidine 50mg/ml Injection', 'Pethidine', '50 mg/ml', 'injection', '1 ampoule × 1 ml', 'Martindale', 'Pain & Fever', 'Vial', 'Medical Stores Department (MSD)', 2500, 6000, true, true, 5, 0, [[10, 'PTH-0302', 410]]],
            ['TP-034', 'Salbutamol Inhaler', 'Salbutamol', '100 mcg/dose', 'inhaler', '1 inhaler × 200 doses', 'GSK', 'Cough, Cold & Flu', 'Piece', 'Laborex Tanzania Ltd', 7000, 11000, true, false, 5, 1, [[3, 'SAL-6610', 330]]],
            ['TP-035', 'Insulin Mixtard 30/70', 'Human insulin', '100 IU/ml', 'injection', '1 vial × 10 ml', 'Novo Nordisk', 'Diabetes', 'Vial', 'Laborex Tanzania Ltd', 16000, 24000, true, false, 4, 0, []],
        ];

        $productService = app(ProductService::class);

        foreach ($rows as $i => [$sku, $name, $generic, $strength, $form, $pack, $maker, $category, $unitName, $supplier, $cost, $price, $rx, $ctrl, $reorder, $weight, $batches]) {
            $first = $batches[0] ?? null;
            // Batches that expire before "today" are received at the start of the history
            // (when they were still in date), so FEFO sells from them first.
            $product = $productService->create([
                'sku' => $sku,
                'name' => $name,
                'generic_name' => $generic,
                'strength' => $strength,
                'dosage_form' => $form,
                'pack_size' => $pack,
                'manufacturer' => $maker,
                'category_id' => $cat[$category] ?? null,
                'unit_id' => $unit[$unitName] ?? null,
                'supplier_id' => $sup[$supplier] ?? null,
                'cost_price' => $cost,
                'selling_price' => $price,
                'wholesale_price' => round($price * 0.85, -1),
                'minimum_selling_price' => $cost,
                'tax_rate' => 0,
                'reorder_level' => $reorder,
                'max_stock_level' => max(10, $reorder * 8),
                'shelf_location' => 'Shelf '.chr(65 + intdiv($i, 6)).'-'.(($i % 6) + 1),
                'requires_prescription' => $rx,
                'is_controlled' => $ctrl,
                'status' => 'active',
                'generate_barcode' => true,
                'branch_id' => $this->main->id,
                'opening_stock' => $first ? $first[0] : 0,
                'opening_batch_number' => $first ? $first[1] : null,
                'opening_expiry_date' => $first ? $exp($first[2]) : null,
            ], $this->owner);

            foreach (array_slice($batches, 1) as [$qty, $batch, $days]) {
                app(PharmacyStockService::class)->receive($product, $this->main->id, $qty, $batch, $exp($days), 'purchase', 'Delivery', $this->storekeeper->id);
            }

            $this->products[$sku] = $product;
            $this->catalogue[$sku] = ['rx' => $rx, 'ctrl' => $ctrl, 'weight' => $weight, 'price' => $price, 'form' => $form];
        }
    }

    // --------------------------------------------------------------- trading

    private function tradeDay(Carbon $day, bool $isToday, Carbon $realNow): void
    {
        $tz = $this->business->timezone ?: 'Africa/Dar_es_Salaam';
        $localDay = $day->copy()->setTimezone($tz);

        // Sale times in the shop's local day: 08:00–20:00, or up to "now" for today.
        $open = $localDay->copy()->setTime(8, 0);
        $close = $isToday ? $realNow->copy()->setTimezone($tz)->subMinutes(3) : $localDay->copy()->setTime(20, 0);
        if ($isToday && $close->lte($open)) {
            // Early morning: today's trading started just after midnight-ish opening.
            $open = $close->copy()->subHours(2)->max($localDay->copy()->startOfDay()->addMinutes(5));
        }

        $count = $isToday ? 9 : ($localDay->isWeekend() ? mt_rand(7, 11) : mt_rand(5, 9));
        $times = [];
        $span = max(1, $open->diffInSeconds($close));
        for ($i = 0; $i < $count; $i++) {
            $times[] = $open->copy()->addSeconds(mt_rand(0, (int) $span));
        }
        sort($times);

        Carbon::setTestNow($open->copy()->subMinutes(10)->utc());
        $this->shift = app(CashierShiftService::class)->open($this->cashier, $this->main->id, 50000);

        foreach ($times as $t) {
            Carbon::setTestNow($t->copy()->utc());
            $this->ringUpSale();
        }

        if (! $isToday) {
            Carbon::setTestNow($close->copy()->addMinutes(15)->utc());
            $shiftService = app(CashierShiftService::class);
            $expected = (float) $this->shift->opening_cash + (float) \App\Models\Payment::whereHas('sale', fn ($q) => $q->where('shift_id', $this->shift->id)->where('status', 'completed'))
                ->whereHas('paymentMethod', fn ($q) => $q->where('type', 'cash'))->sum('amount');
            // Most days balance; now and then the till is a little short or over.
            $diff = [0, 0, 0, 0, 0, -500, -1000, 500][mt_rand(0, 7)];
            $shiftService->close($this->shift, $expected + $diff, $diff < 0 ? 'Short — counted twice.' : null);
        }
    }

    private function ringUpSale(): void
    {
        $stock = app(PharmacyStockService::class);
        $basket = [];
        $lines = mt_rand(1, 100) <= 55 ? 1 : (mt_rand(1, 100) <= 75 ? 2 : 3);
        $needsRx = false;

        for ($i = 0; $i < $lines; $i++) {
            $sku = $this->pick();
            if (isset($basket[$sku])) {
                continue;
            }
            $form = $this->catalogue[$sku]['form'];
            $qty = in_array($form, ['tablet', 'capsule', 'sachet'], true) ? mt_rand(1, 3) : 1;
            if ($stock->sellableQuantity($this->products[$sku]->id, $this->main->id) < $qty) {
                continue;
            }
            $basket[$sku] = $qty;
            $needsRx = $needsRx || $this->catalogue[$sku]['rx'];
        }
        if (! $basket) {
            return;
        }

        $customer = mt_rand(1, 100) <= 35 ? $this->customers[mt_rand(0, 4)] : null;
        $items = [];
        $total = 0;
        foreach ($basket as $sku => $qty) {
            $item = ['product_id' => $this->products[$sku]->id, 'quantity' => $qty];
            if ($this->catalogue[$sku]['rx'] || mt_rand(1, 100) <= 40) {
                $item['dosage_instructions'] = $this->dosageFor($this->catalogue[$sku]['form']);
            }
            $items[] = $item;
            $total += $this->catalogue[$sku]['price'] * $qty;
        }

        $method = ['cash', 'cash', 'cash', 'mobile_money', 'mobile_money', 'card'][mt_rand(0, 5)];
        $paid = $method === 'cash' ? (int) (ceil($total / 1000) * 1000) : $total;

        $data = [
            'branch_id' => $this->main->id,
            'shift_id' => $this->shift?->id,
            'customer_id' => $customer?->id,
            'items' => $items,
            'payments' => [[
                'payment_method_id' => $this->methods[$method],
                'amount' => $paid,
                'reference' => $method === 'mobile_money' ? 'MP'.strtoupper(substr(md5((string) mt_rand()), 0, 8)) : null,
            ]],
        ];
        if ($needsRx) {
            $data['prescription'] = $this->prescription($customer);
        }

        $this->sales[] = app(SaleService::class)->createSale($data, $this->cashier);
    }

    /** Weighted pick so fast movers (Panadol, ORS, ALU) sell far more than slow ones. */
    private function pick(): string
    {
        $total = array_sum(array_column($this->catalogue, 'weight'));
        $r = mt_rand(1, max(1, $total));
        foreach ($this->catalogue as $sku => $c) {
            $r -= $c['weight'];
            if ($r <= 0) {
                return $sku;
            }
        }

        return array_key_first($this->catalogue);
    }

    private function dosageFor(string $form): string
    {
        return match ($form) {
            'syrup', 'suspension' => ['5 ml 3 times daily', '10 ml 3 times daily'][mt_rand(0, 1)],
            'cream', 'ointment', 'gel', 'lotion' => 'Apply twice daily',
            'drops' => '2 drops in the affected eye 3 times daily',
            'inhaler' => '2 puffs when needed for breathing difficulty',
            'injection', 'device' => 'As directed by the doctor',
            default => ['1 tablet 3 times daily after meals', '2 tablets 3 times daily after meals', '1 tablet twice daily', '1 tablet once daily', '2 tablets every 6 hours if needed for pain'][mt_rand(0, 4)],
        };
    }

    private function prescription(?Customer $customer): array
    {
        $prescribers = [
            ['Dr. Joseph Mrema', 'MCT 4521', 'Mwananyamala Regional Hospital'],
            ['Dr. Salma Hamisi', 'MCT 6187', 'Aga Khan Hospital'],
            ['Dr. Peter Lyimo', 'MCT 3302', 'Kairuki Hospital'],
            ['Dr. Fatuma Ally', 'MCT 7790', 'Sinza Family Clinic'],
            ['Dr. Emmanuel Shayo', 'MCT 5046', 'Amana Regional Hospital'],
        ];
        $patients = [['Hassan Omari', 42], ['Zawadi Mushi', 29], ['Baraka Mbwambo', 7], ['Upendo Kessy', 61], ['Rashidi Nyoni', 35], ['Mwanaidi Saidi', 54], ['Kelvin Temba', 23], ['Esther Minja', 38]];
        [$name, $reg, $facility] = $prescribers[mt_rand(0, count($prescribers) - 1)];
        [$patient, $age] = $customer ? [$customer->name, mt_rand(20, 65)] : $patients[mt_rand(0, count($patients) - 1)];

        return [
            'rx_number' => 'RX-'.now()->format('ymd').'-'.mt_rand(100, 999),
            'prescriber_name' => $name,
            'prescriber_reg_no' => $reg,
            'facility' => $facility,
            'issued_on' => now()->subDays(mt_rand(0, 2))->toDateString(),
            'patient_name' => $patient,
            'patient_age' => $age,
            'patient_phone' => $customer?->phone,
        ];
    }

    // --------------------------------------------------- once-off day events

    private function dailyEvents(int $d, Carbon $day, Carbon $realNow): void
    {
        $at = fn (int $h, int $m = 0) => Carbon::setTestNow($day->copy()->setTimezone($this->business->timezone ?: 'Africa/Dar_es_Salaam')->setTime($h, $m)->utc());
        $exp = fn (int $days) => $realNow->copy()->addDays($days)->toDateString();
        $sup = Supplier::where('business_id', $this->business->id)->pluck('id', 'name');

        switch ($d) {
            case 3: // Purchase order to MSD → approved → converted → received in full → paid in part
                $at(10);
                $po = app(PurchaseOrderService::class)->create([
                    'branch_id' => $this->main->id, 'supplier_id' => $sup['Medical Stores Department (MSD)'],
                    'notes' => 'Monthly restock — antimalarials and ORS',
                    'items' => [
                        ['product_id' => $this->products['TP-010']->id, 'quantity_ordered' => 60, 'unit_cost' => 4400],
                        ['product_id' => $this->products['TP-018']->id, 'quantity_ordered' => 200, 'unit_cost' => 200],
                        ['product_id' => $this->products['TP-012']->id, 'quantity_ordered' => 50, 'unit_cost' => 800],
                    ],
                ], $this->pharmacist);
                app(PurchaseOrderService::class)->updateStatus($po, 'approved');
                $purchase = app(PurchaseOrderService::class)->convertToPurchase($po->fresh(), $this->pharmacist);
                $at(15);
                $receipts = [];
                foreach ($purchase->items as $item) {
                    $batch = match ($item->product_id) {
                        $this->products['TP-010']->id => ['ALU-6130', $exp(540)],
                        $this->products['TP-018']->id => ['ORS-8120', $exp(700)],
                        default => ['MRDT-305', $exp(380)],
                    };
                    $receipts[] = ['purchase_item_id' => $item->id, 'quantity' => $item->quantity_ordered, 'batch_number' => $batch[0], 'expiry_date' => $batch[1]];
                }
                $purchase = app(PurchaseService::class)->receive($purchase, $receipts, $this->storekeeper);
                app(PurchaseService::class)->recordPayment($purchase, 200000, $this->methods['bank_transfer'], 'CRDB-TT-55102', $this->owner);
                break;

            case 6: // Direct purchase from Laborex, including a controlled medicine
                $at(11);
                $purchase = app(PurchaseService::class)->create([
                    'branch_id' => $this->main->id, 'supplier_id' => $sup['Laborex Tanzania Ltd'],
                    'notes' => 'Invoice LBX-22871',
                    'items' => [
                        ['product_id' => $this->products['TP-001']->id, 'quantity_ordered' => 100, 'unit_cost' => 1200],
                        ['product_id' => $this->products['TP-031']->id, 'quantity_ordered' => 30, 'unit_cost' => 1500],
                        ['product_id' => $this->products['TP-013']->id, 'quantity_ordered' => 24, 'unit_cost' => 5500],
                    ],
                ], $this->pharmacist);
                $items = $purchase->items->keyBy('product_id');
                $purchase = app(PurchaseService::class)->receive($purchase, [
                    ['purchase_item_id' => $items[$this->products['TP-001']->id]->id, 'quantity' => 100, 'batch_number' => 'PAN2412F', 'expiry_date' => $exp(500)],
                    ['purchase_item_id' => $items[$this->products['TP-031']->id]->id, 'quantity' => 30, 'batch_number' => 'TRM-2260', 'expiry_date' => $exp(560)],
                    ['purchase_item_id' => $items[$this->products['TP-013']->id]->id, 'quantity' => 24, 'batch_number' => 'BEN-3412', 'expiry_date' => $exp(480)],
                ], $this->storekeeper);
                $total = (float) $purchase->grand_total;
                app(PurchaseService::class)->recordPayment($purchase, $total, $this->methods['mobile_money'], 'MPESA-LBX-22871', $this->owner);

                // Three cough syrup bottles arrived broken — sent back to Laborex.
                $at(16);
                app(PurchaseReturnService::class)->create($purchase, [
                    ['purchase_item_id' => $items[$this->products['TP-013']->id]->id, 'quantity' => 3],
                ], 'Bottles broken in transit', $this->pharmacist);
                break;

            case 9: // Credit sale to the clinic, part-paid later
                $at(9, 40);
                $clinic = $this->customers[5];
                $sale = app(SaleService::class)->createSale([
                    'branch_id' => $this->main->id,
                    'customer_id' => $clinic->id,
                    'items' => [
                        ['product_id' => $this->products['TP-027']->id, 'quantity' => 4, 'unit_price' => 12000],
                        ['product_id' => $this->products['TP-018']->id, 'quantity' => 50, 'unit_price' => 400],
                        ['product_id' => $this->products['TP-002']->id, 'quantity' => 40, 'unit_price' => 450],
                    ],
                    'payments' => [['payment_method_id' => $this->methods['cash'], 'amount' => 20000]],
                    'notes' => 'Monthly clinic supply — on account',
                ], $this->owner);
                $this->sales[] = $sale;
                $at(17);
                app(CustomerService::class)->recordPayment($clinic, $sale, 40000, $this->methods['bank_transfer'], 'NMB-REF-77120', $this->owner);
                break;

            case 12: // Broken stock written off
                $at(13);
                app(PharmacyStockService::class)->remove($this->products['TP-017'], $this->main->id, 2, 'damaged', null, 'Bottles dropped while restocking shelf', $this->storekeeper->id);
                break;

            case 15: // Stock transfer to the Mbezi branch (batches travel with the stock)
                $at(9);
                $transfers = app(StockTransferService::class);
                $transfer = $transfers->create(
                    ['from_branch_id' => $this->main->id, 'to_branch_id' => $this->second->id, 'notes' => 'Opening stock for Mbezi Beach branch'],
                    [
                        ['product_id' => $this->products['TP-001']->id, 'quantity' => 30],
                        ['product_id' => $this->products['TP-018']->id, 'quantity' => 40],
                        ['product_id' => $this->products['TP-010']->id, 'quantity' => 15],
                        ['product_id' => $this->products['TP-014']->id, 'quantity' => 20],
                        ['product_id' => $this->products['TP-031']->id, 'quantity' => 5],
                    ],
                    $this->storekeeper,
                );
                $transfers->request($transfer);
                $transfers->approve($transfer, $this->pharmacist);
                $at(10);
                $transfers->dispatch($transfer->fresh('items'), $this->storekeeper);
                $at(14);
                $transfers->receive($transfer->fresh('items'), $this->pharmacist);
                break;

            case 18: // Customer return: a sellable item goes back into its batch
                $at(12);
                $sale = collect($this->sales)->first(fn (Sale $s) => $s->status === 'completed' && $s->items->contains(fn ($i) => $i->quantity >= 2 && $i->price_divisor == 1));
                if ($sale) {
                    $item = $sale->items->first(fn ($i) => $i->quantity >= 2);
                    app(SaleReturnService::class)->create($sale, [
                        ['sale_item_id' => $item->id, 'quantity' => 1, 'condition' => 'sellable'],
                    ], $this->methods['cash'], 'Customer bought one strip too many — unopened', $this->pharmacist);
                }
                break;

            case 22: // Pending purchase order (draft) — waiting for approval
                $at(11);
                app(PurchaseOrderService::class)->create([
                    'branch_id' => $this->main->id, 'supplier_id' => $sup['Shelys Pharmaceuticals'],
                    'notes' => 'Antibiotics restock — check prices first',
                    'items' => [
                        ['product_id' => $this->products['TP-005']->id, 'quantity_ordered' => 100, 'unit_cost' => 1450],
                        ['product_id' => $this->products['TP-008']->id, 'quantity_ordered' => 100, 'unit_cost' => 300],
                    ],
                ], $this->pharmacist);
                // Partially delivered order from Salama
                $purchase = app(PurchaseService::class)->create([
                    'branch_id' => $this->main->id, 'supplier_id' => $sup['Salama Pharma Wholesale'],
                    'notes' => 'Insulin & inhalers — second half due next week',
                    'items' => [
                        ['product_id' => $this->products['TP-034']->id, 'quantity_ordered' => 10, 'unit_cost' => 7000],
                        ['product_id' => $this->products['TP-035']->id, 'quantity_ordered' => 10, 'unit_cost' => 16000],
                    ],
                ], $this->pharmacist);
                $items = $purchase->items->keyBy('product_id');
                app(PurchaseService::class)->receive($purchase, [
                    ['purchase_item_id' => $items[$this->products['TP-034']->id]->id, 'quantity' => 4, 'batch_number' => 'SAL-6702', 'expiry_date' => $exp(420)],
                    ['purchase_item_id' => $items[$this->products['TP-035']->id]->id, 'quantity' => 3, 'batch_number' => 'INS-MX-889', 'expiry_date' => $exp(150)],
                ], $this->storekeeper);
                break;

            case 26: // Monthly stock take on a few lines
                $at(18, 30);
                $takes = app(StockTakeService::class);
                $ids = [$this->products['TP-003']->id, $this->products['TP-015']->id, $this->products['TP-019']->id, $this->products['TP-029']->id];
                $take = $takes->create($this->main->id, $ids, $this->storekeeper);
                $counts = [];
                foreach ($take->items as $item) {
                    $variance = match ($item->product_id) {
                        $this->products['TP-003']->id => -2,   // two strips missing
                        $this->products['TP-029']->id => -1,
                        default => 0,
                    };
                    $counts[] = ['item_id' => $item->id, 'counted_quantity' => max(0, $item->system_quantity + $variance)];
                }
                $takes->recordCounts($take, $counts);
                $takes->submit($take->fresh());
                $takes->approve($take->fresh('items'), $this->pharmacist);
                break;

            case 30: // Expired eye drops pulled off the shelf for disposal
                $at(9, 15);
                $stock = app(PharmacyStockService::class);
                $p = $this->products['TP-025'];
                $expired = $stock->expiredQuantity($p->id, $this->main->id);
                if ($expired > 0) {
                    $stock->remove($p, $this->main->id, min(5, $expired), 'expired', null, 'Expired — handed to TMDA for disposal', $this->pharmacist->id);
                }
                break;

            case 33: // Controlled drug dispensed against a prescription (pethidine — receive first)
                $at(10, 30);
                $stock = app(PharmacyStockService::class);
                $stock->receive($this->products['TP-033'], $this->main->id, 10, 'PTH-0302', $exp(410), 'purchase', 'MSD controlled delivery', $this->pharmacist->id);
                $at(16, 10);
                $this->sales[] = app(SaleService::class)->createSale([
                    'branch_id' => $this->main->id,
                    'items' => [['product_id' => $this->products['TP-033']->id, 'quantity' => 2, 'dosage_instructions' => 'For ward use — administer as directed by the doctor']],
                    'payments' => [['payment_method_id' => $this->methods['cash'], 'amount' => 12000]],
                    'prescription' => [
                        'rx_number' => 'RX-AMN-30917', 'prescriber_name' => 'Dr. Emmanuel Shayo', 'prescriber_reg_no' => 'MCT 5046',
                        'facility' => 'Amana Regional Hospital', 'issued_on' => now()->toDateString(),
                        'patient_name' => 'Rashidi Nyoni', 'patient_age' => 35, 'notes' => 'Post-operative pain. ID checked (NIDA).',
                    ],
                ], $this->pharmacist);
                break;
        }
    }

    // ------------------------------------------------------ after the history

    private function afterTrading(): void
    {
        $b = $this->business;

        // A sale left on hold at the counter (customer went to fetch money).
        $this->sales[] = app(SaleService::class)->createSale([
            'branch_id' => $this->main->id,
            'shift_id' => $this->shift?->id,
            'hold' => true,
            'customer_name' => 'Walk-in (gone to ATM)',
            'items' => [
                ['product_id' => $this->products['TP-016']->id, 'quantity' => 2],
                ['product_id' => $this->products['TP-026']->id, 'quantity' => 1],
            ],
        ], $this->cashier);

        // Quotations
        $quotes = app(QuotationService::class);
        $q1 = $quotes->create(
            ['branch_id' => $this->main->id, 'customer_id' => $this->customers[5]->id, 'customer_name' => $this->customers[5]->name, 'valid_until' => now()->addDays(14)->toDateString(), 'notes' => 'Quarterly supply for the clinic', 'payment_terms' => '30 days'],
            [
                ['product_id' => $this->products['TP-027']->id, 'quantity' => 10, 'unit_price' => 12500],
                ['product_id' => $this->products['TP-012']->id, 'quantity' => 50, 'unit_price' => 1700],
                ['product_id' => $this->products['TP-018']->id, 'quantity' => 200, 'unit_price' => 400],
            ],
            $this->owner,
        );
        $quotes->updateStatus($q1, 'sent');
        $quotes->create(
            ['branch_id' => $this->main->id, 'customer_id' => $this->customers[6]->id, 'customer_name' => $this->customers[6]->name, 'valid_until' => now()->addDays(7)->toDateString(), 'notes' => 'First aid kits for the day care'],
            [
                ['product_id' => $this->products['TP-028']->id, 'quantity' => 10],
                ['product_id' => $this->products['TP-024']->id, 'quantity' => 5],
                ['product_id' => $this->products['TP-002']->id, 'quantity' => 10],
            ],
            $this->owner,
        );

        // Expenses over the month
        $categories = collect(['Rent & Utilities', 'Staff Salaries', 'Licences & Permits', 'Transport & Delivery', 'Cleaning & Waste Disposal'])
            ->mapWithKeys(fn ($n) => [$n => ExpenseCategory::firstOrCreate(['business_id' => $b->id, 'name' => $n])]);
        foreach ([
            ['Rent & Utilities', 'Shop rent — Sinza Mori', 900000, 30, 'bank_transfer'],
            ['Rent & Utilities', 'LUKU electricity tokens', 60000, 21, 'mobile_money'],
            ['Rent & Utilities', 'DAWASA water bill', 25000, 14, 'mobile_money'],
            ['Staff Salaries', 'Salaries — pharmacist, cashier, store keeper', 2100000, 3, 'bank_transfer'],
            ['Licences & Permits', 'Pharmacy Council premises permit renewal', 150000, 25, 'bank_transfer'],
            ['Transport & Delivery', 'Bodaboda deliveries to clinics', 35000, 9, 'cash'],
            ['Transport & Delivery', 'Pickup from MSD Keko', 40000, 32, 'cash'],
            ['Cleaning & Waste Disposal', 'Expired medicine disposal fee (TMDA)', 20000, 5, 'cash'],
        ] as [$cat, $desc, $amount, $daysAgo, $method]) {
            Expense::create([
                'business_id' => $b->id, 'branch_id' => $this->main->id, 'expense_category_id' => $categories[$cat]->id,
                'amount' => $amount, 'description' => $desc, 'date' => now()->subDays($daysAgo)->toDateString(),
                'payment_method_id' => $this->methods[$method], 'created_by' => $this->owner->id,
            ]);
        }

        BusinessNotification::create([
            'business_id' => $b->id, 'type' => 'expiry',
            'title' => 'Expired stock on the shelf',
            'message' => 'Amoxicillin 500mg (batch AMX-0921) and Gentamicin Eye Drops (batch GEN-0417) have expired. Remove them under Expiry.',
            'read_at' => null,
        ]);
        BusinessNotification::create([
            'business_id' => $b->id, 'type' => 'expiry',
            'title' => 'Medicines expiring within 30 days',
            'message' => 'Relcer Gel, ALU 20/120 (batch ALU-4417) and Azithromycin 500mg expire within a month — sell these first.',
            'read_at' => null,
        ]);
    }
}
