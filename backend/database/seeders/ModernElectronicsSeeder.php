<?php

namespace Database\Seeders;

use App\Models\Barcode;
use App\Models\Branch;
use App\Models\Brand;
use App\Models\Business;
use App\Models\BusinessNotification;
use App\Models\CashierShift;
use App\Models\Customer;
use App\Models\CustomerPayment;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\Inventory;
use App\Models\LoyaltyTransaction;
use App\Models\Payment;
use App\Models\PaymentMethod;
use App\Models\Product;
use App\Models\ProductBatch;
use App\Models\ProductCategory;
use App\Models\Purchase;
use App\Models\PurchaseItem;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\PurchaseReturn;
use App\Models\PurchaseReturnItem;
use App\Models\Quotation;
use App\Models\QuotationItem;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\SaleReturn;
use App\Models\SaleReturnItem;
use App\Models\StaffProfile;
use App\Models\StockMovement;
use App\Models\StockTake;
use App\Models\StockTakeItem;
use App\Models\StockTransfer;
use App\Models\StockTransferItem;
use App\Models\Supplier;
use App\Models\SupplierPayment;
use App\Models\Unit;
use App\Models\User;
use App\Support\Tenancy\BusinessContext;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Populates the real "MODERN ELECTRONICS" business (registered through the normal
 * sign-up flow, not created here) with a realistic electronics-retail dataset spanning
 * every module: catalog, inventory, purchasing, sales, stock operations, customers,
 * staff, quotations, expenses and notifications. Idempotent — safe to re-run.
 */
class ModernElectronicsSeeder extends Seeder
{
    public function run(): void
    {
        $business = Business::withoutGlobalScopes()->where('slug', 'modern-electronics')->firstOrFail();

        BusinessContext::set($business->id);

        try {
            $this->seed($business);
        } finally {
            BusinessContext::set(null);
        }
    }

    private function seed(Business $business): void
    {
        $owner = User::withoutGlobalScopes()->findOrFail($business->owner_user_id);
        $mainBranch = Branch::where('business_id', $business->id)->where('is_main', true)->firstOrFail();
        $cityBranch = Branch::firstOrCreate(
            ['business_id' => $business->id, 'code' => 'KRK'],
            ['name' => 'Kariakoo Branch', 'is_main' => false, 'status' => 'active'],
        );

        $paymentMethods = PaymentMethod::where('business_id', $business->id)->get()->keyBy('type');

        $categories = $this->categories($business->id);
        $brands = $this->brands($business->id);
        $units = $this->units($business->id);
        $suppliers = $this->suppliers($business->id);
        $products = $this->products($business->id, $owner, $categories, $brands, $units, $suppliers, $mainBranch->id);
        $this->barcodes($business->id, $products);
        $staff = $this->staff($business->id, $mainBranch->id, $cityBranch->id);
        $customers = $this->customers($business->id);

        $shifts = $this->shifts($business->id, $mainBranch->id, $owner, $staff);
        $sales = $this->sales($business->id, $mainBranch->id, $owner, $staff, $customers, $products, $paymentMethods, $shifts);

        $this->purchasing($business->id, $mainBranch->id, $owner, $suppliers, $products, $paymentMethods);
        $this->stockOperations($business->id, $mainBranch->id, $cityBranch->id, $owner, $products);
        $this->customerFinancials($business->id, $customers, $sales, $paymentMethods, $owner);
        $this->quotations($business->id, $mainBranch->id, $owner, $customers, $products);
        $this->expenses($business->id, $mainBranch->id, $owner, $paymentMethods);
        $this->notifications($business->id, $products);
    }

    private function categories(int $businessId)
    {
        return collect([
            'Smartphones & Tablets',
            'Laptops & Computers',
            'TVs & Home Theatre',
            'Audio & Headphones',
            'Gaming & Accessories',
            'Cameras & Photography',
            'Networking',
            'Power & Charging',
        ])->mapWithKeys(fn (string $name) => [
            $name => ProductCategory::firstOrCreate(['business_id' => $businessId, 'parent_id' => null, 'name' => $name]),
        ]);
    }

    private function brands(int $businessId)
    {
        return collect(['Samsung', 'Apple', 'Xiaomi', 'Infinix', 'HP', 'Dell', 'Lenovo', 'Sony', 'JBL', 'Anker', 'TP-Link', 'Canon'])
            ->mapWithKeys(fn (string $name) => [$name => Brand::firstOrCreate(['business_id' => $businessId, 'name' => $name])]);
    }

    private function units(int $businessId)
    {
        return collect([
            ['name' => 'Piece', 'short_name' => 'pc'],
            ['name' => 'Set', 'short_name' => 'set'],
            ['name' => 'Box', 'short_name' => 'box'],
        ])->mapWithKeys(fn (array $data) => [$data['name'] => Unit::firstOrCreate(['business_id' => $businessId, 'name' => $data['name']], $data)]);
    }

    private function suppliers(int $businessId)
    {
        return collect([
            ['name' => 'Mlimani Electronics Distributors', 'contact_person' => 'Ismail Chande', 'phone' => '+255 754 220 118', 'email' => 'sales@mlimanielectronics.example.test'],
            ['name' => 'TechHub East Africa Ltd', 'contact_person' => 'Rehema Kimaro', 'phone' => '+255 713 508 942', 'email' => 'orders@techhubea.example.test'],
            ['name' => 'Kariakoo Gadgets Wholesale', 'contact_person' => 'Yassin Mrisho', 'phone' => '+255 767 341 205', 'email' => 'wholesale@kariakoogadgets.example.test'],
        ])->mapWithKeys(fn (array $data) => [$data['name'] => Supplier::firstOrCreate(['business_id' => $businessId, 'name' => $data['name']], $data)]);
    }

    private function products(int $businessId, User $owner, $categories, $brands, $units, $suppliers, int $mainBranchId)
    {
        $data = [
            ['sku' => 'SMT-001', 'name' => 'Samsung Galaxy A15 128GB', 'category' => 'Smartphones & Tablets', 'brand' => 'Samsung', 'unit' => 'Piece', 'supplier' => 'Mlimani Electronics Distributors', 'cost' => 380000, 'price' => 465000, 'stock' => 25, 'reorder' => 6],
            ['sku' => 'SMT-002', 'name' => 'Apple iPhone 13 128GB', 'category' => 'Smartphones & Tablets', 'brand' => 'Apple', 'unit' => 'Piece', 'supplier' => 'TechHub East Africa Ltd', 'cost' => 1550000, 'price' => 1850000, 'stock' => 8, 'reorder' => 3],
            ['sku' => 'SMT-003', 'name' => 'Xiaomi Redmi Note 13', 'category' => 'Smartphones & Tablets', 'brand' => 'Xiaomi', 'unit' => 'Piece', 'supplier' => 'Kariakoo Gadgets Wholesale', 'cost' => 310000, 'price' => 385000, 'stock' => 20, 'reorder' => 6],
            ['sku' => 'SMT-004', 'name' => 'Infinix Hot 40', 'category' => 'Smartphones & Tablets', 'brand' => 'Infinix', 'unit' => 'Piece', 'supplier' => 'Kariakoo Gadgets Wholesale', 'cost' => 260000, 'price' => 325000, 'stock' => 30, 'reorder' => 8],
            ['sku' => 'SMT-005', 'name' => 'Samsung Galaxy Tab A9', 'category' => 'Smartphones & Tablets', 'brand' => 'Samsung', 'unit' => 'Piece', 'supplier' => 'Mlimani Electronics Distributors', 'cost' => 320000, 'price' => 399000, 'stock' => 12, 'reorder' => 4],
            ['sku' => 'LAP-001', 'name' => 'HP Pavilion 15 (i5, 8GB, 512GB SSD)', 'category' => 'Laptops & Computers', 'brand' => 'HP', 'unit' => 'Piece', 'supplier' => 'TechHub East Africa Ltd', 'cost' => 1180000, 'price' => 1450000, 'stock' => 10, 'reorder' => 3],
            ['sku' => 'LAP-002', 'name' => 'Dell Inspiron 15 (i5, 8GB, 1TB)', 'category' => 'Laptops & Computers', 'brand' => 'Dell', 'unit' => 'Piece', 'supplier' => 'TechHub East Africa Ltd', 'cost' => 1350000, 'price' => 1650000, 'stock' => 6, 'reorder' => 3],
            ['sku' => 'LAP-003', 'name' => 'Lenovo IdeaPad Slim 3', 'category' => 'Laptops & Computers', 'brand' => 'Lenovo', 'unit' => 'Piece', 'supplier' => 'TechHub East Africa Ltd', 'cost' => 1020000, 'price' => 1250000, 'stock' => 8, 'reorder' => 3],
            ['sku' => 'TVH-001', 'name' => 'Samsung 43" Smart TV', 'category' => 'TVs & Home Theatre', 'brand' => 'Samsung', 'unit' => 'Piece', 'supplier' => 'Mlimani Electronics Distributors', 'cost' => 600000, 'price' => 750000, 'stock' => 7, 'reorder' => 2],
            ['sku' => 'TVH-002', 'name' => 'Sony 55" 4K UHD TV', 'category' => 'TVs & Home Theatre', 'brand' => 'Sony', 'unit' => 'Piece', 'supplier' => 'TechHub East Africa Ltd', 'cost' => 1650000, 'price' => 1950000, 'stock' => 4, 'reorder' => 2],
            ['sku' => 'AUD-001', 'name' => 'JBL Flip 6 Bluetooth Speaker', 'category' => 'Audio & Headphones', 'brand' => 'JBL', 'unit' => 'Piece', 'supplier' => 'Kariakoo Gadgets Wholesale', 'cost' => 145000, 'price' => 185000, 'stock' => 18, 'reorder' => 5],
            ['sku' => 'AUD-002', 'name' => 'Sony WH-CH520 Wireless Headphones', 'category' => 'Audio & Headphones', 'brand' => 'Sony', 'unit' => 'Piece', 'supplier' => 'TechHub East Africa Ltd', 'cost' => 72000, 'price' => 95000, 'stock' => 15, 'reorder' => 5],
            ['sku' => 'AUD-003', 'name' => 'Apple AirPods (3rd Gen)', 'category' => 'Audio & Headphones', 'brand' => 'Apple', 'unit' => 'Piece', 'supplier' => 'TechHub East Africa Ltd', 'cost' => 230000, 'price' => 285000, 'stock' => 10, 'reorder' => 4],
            ['sku' => 'GAM-001', 'name' => 'Sony PS5 DualSense Controller', 'category' => 'Gaming & Accessories', 'brand' => 'Sony', 'unit' => 'Piece', 'supplier' => 'TechHub East Africa Ltd', 'cost' => 115000, 'price' => 145000, 'stock' => 9, 'reorder' => 3],
            ['sku' => 'CAM-001', 'name' => 'Canon EOS 2000D DSLR Kit', 'category' => 'Cameras & Photography', 'brand' => 'Canon', 'unit' => 'Piece', 'supplier' => 'TechHub East Africa Ltd', 'cost' => 1080000, 'price' => 1350000, 'stock' => 5, 'reorder' => 2],
            ['sku' => 'NET-001', 'name' => 'TP-Link Archer C6 AC1200 Router', 'category' => 'Networking', 'brand' => 'TP-Link', 'unit' => 'Piece', 'supplier' => 'Kariakoo Gadgets Wholesale', 'cost' => 85000, 'price' => 110000, 'stock' => 14, 'reorder' => 4],
            ['sku' => 'PWR-001', 'name' => 'Anker PowerCore 20000mAh Power Bank', 'category' => 'Power & Charging', 'brand' => 'Anker', 'unit' => 'Piece', 'supplier' => 'Kariakoo Gadgets Wholesale', 'cost' => 72000, 'price' => 95000, 'stock' => 22, 'reorder' => 6],
            ['sku' => 'PWR-002', 'name' => 'Samsung 25W Fast Charger', 'category' => 'Power & Charging', 'brand' => 'Samsung', 'unit' => 'Piece', 'supplier' => 'Mlimani Electronics Distributors', 'cost' => 25000, 'price' => 35000, 'stock' => 40, 'reorder' => 10],
            ['sku' => 'PWR-003', 'name' => 'USB-C Charging Cable 1m', 'category' => 'Power & Charging', 'brand' => null, 'unit' => 'Piece', 'supplier' => 'Kariakoo Gadgets Wholesale', 'cost' => 8000, 'price' => 12000, 'stock' => 60, 'reorder' => 15],
        ];

        return collect($data)->mapWithKeys(function (array $d) use ($businessId, $owner, $categories, $brands, $units, $suppliers, $mainBranchId) {
            $product = Product::updateOrCreate(
                ['business_id' => $businessId, 'sku' => $d['sku']],
                [
                    'category_id' => $categories[$d['category']]->id,
                    'brand_id' => $d['brand'] ? $brands[$d['brand']]->id : null,
                    'unit_id' => $units[$d['unit']]->id,
                    'supplier_id' => $suppliers[$d['supplier']]->id,
                    'name' => $d['name'],
                    'cost_price' => $d['cost'],
                    'selling_price' => $d['price'],
                    'wholesale_price' => $d['price'] * 0.92,
                    'minimum_selling_price' => $d['cost'] * 1.05,
                    'reorder_level' => $d['reorder'],
                    'max_stock_level' => $d['stock'] * 4,
                    'shelf_location' => substr($d['sku'], 0, 3).'-'.substr($d['sku'], -3),
                    'status' => 'active',
                    'created_by' => $owner->id,
                ],
            );

            Inventory::updateOrCreate(
                ['business_id' => $businessId, 'product_id' => $product->id, 'branch_id' => $mainBranchId],
                ['quantity' => $d['stock'], 'reorder_level' => $d['reorder']],
            );

            return [$d['sku'] => $product];
        });
    }

    private function barcodes(int $businessId, $products): void
    {
        $products->values()->each(function (Product $product, int $index) use ($businessId) {
            Barcode::firstOrCreate(
                ['business_id' => $businessId, 'code' => '6009'.str_pad((string) ($index + 1), 9, '0', STR_PAD_LEFT)],
                ['product_id' => $product->id, 'type' => 'EAN13', 'is_primary' => true],
            );
        });
    }

    private function staff(int $businessId, int $mainBranchId, int $cityBranchId)
    {
        $data = [
            ['name' => 'Grace Mmbaga', 'email' => 'grace.mmbaga@modernelectronics.test', 'phone' => '+255 715 220 447', 'role' => 'Cashier', 'job_title' => 'Sales Cashier', 'branch_id' => $mainBranchId],
            ['name' => 'Peter Kileo', 'email' => 'peter.kileo@modernelectronics.test', 'phone' => '+255 786 903 512', 'role' => 'Storekeeper', 'job_title' => 'Store & Inventory Officer', 'branch_id' => $mainBranchId],
            ['name' => 'Halima Juma', 'email' => 'halima.juma@modernelectronics.test', 'phone' => '+255 767 442 810', 'role' => 'Manager', 'job_title' => 'Kariakoo Branch Manager', 'branch_id' => $cityBranchId],
        ];

        return collect($data)->mapWithKeys(function (array $d) use ($businessId) {
            $user = User::updateOrCreate(
                ['business_id' => $businessId, 'email' => $d['email']],
                ['name' => $d['name'], 'phone' => $d['phone'], 'password' => 'Staff@2026', 'status' => 'active', 'email_verified_at' => now()],
            );

            $user->syncRoles([$d['role']]);

            StaffProfile::updateOrCreate(
                ['business_id' => $businessId, 'user_id' => $user->id],
                ['branch_id' => $d['branch_id'], 'job_title' => $d['job_title']],
            );

            return [$d['role'] => $user];
        });
    }

    private function customers(int $businessId)
    {
        return collect([
            ['name' => 'Amani Shirima', 'phone' => '+255 715 226 340', 'email' => 'amani.shirima@example.test', 'customer_type' => 'retail'],
            ['name' => 'Devotha Kessy', 'phone' => '+255 786 118 902', 'email' => 'devotha.kessy@example.test', 'customer_type' => 'retail'],
            ['name' => 'Frank Mushi', 'phone' => '+255 713 667 221', 'email' => 'frank.mushi@example.test', 'customer_type' => 'retail'],
            ['name' => 'Baraka Enterprises Ltd', 'phone' => '+255 754 118 260', 'email' => 'procurement@barakaenterprises.example.test', 'customer_type' => 'wholesale', 'credit_limit' => 500000],
            ['name' => 'Neema Tech Solutions', 'phone' => '+255 767 990 415', 'email' => 'accounts@neematech.example.test', 'customer_type' => 'wholesale', 'credit_limit' => 800000],
        ])->map(fn (array $data) => Customer::updateOrCreate(['business_id' => $businessId, 'phone' => $data['phone']], $data));
    }

    private function shifts(int $businessId, int $branchId, User $owner, $staff)
    {
        $cashier = $staff['Cashier'];

        $closed = CashierShift::firstOrCreate(
            ['business_id' => $businessId, 'branch_id' => $branchId, 'user_id' => $cashier->id, 'opened_at' => now()->subDays(6)->setTime(8, 30)],
            [
                'opening_cash' => 200000,
                'closing_cash' => 612000,
                'expected_cash' => 615000,
                'difference' => -3000,
                'status' => 'closed',
                'closed_at' => now()->subDays(6)->setTime(19, 0),
                'notes' => 'Till short by 3,000 TZS — under investigation.',
            ],
        );

        $open = CashierShift::firstOrCreate(
            ['business_id' => $businessId, 'branch_id' => $branchId, 'user_id' => $owner->id, 'opened_at' => now()->subHours(3)],
            ['opening_cash' => 150000, 'closing_cash' => null, 'expected_cash' => null, 'difference' => null, 'status' => 'open'],
        );

        return ['closed' => $closed, 'open' => $open];
    }

    private function sales(int $businessId, int $branchId, User $owner, $staff, $customers, $products, $paymentMethods, $shifts)
    {
        $cashier = $staff['Cashier'];

        $rows = [
            ['receipt' => 'DEMO-0001', 'sku' => 'SMT-001', 'qty' => 1, 'customer' => $customers[0], 'method' => 'cash', 'cashier' => $cashier, 'shift' => $shifts['closed'], 'date' => now()->subDays(6)->setTime(9, 15)],
            ['receipt' => 'DEMO-0002', 'sku' => 'PWR-002', 'qty' => 3, 'customer' => $customers[1], 'method' => 'mobile_money', 'cashier' => $cashier, 'shift' => $shifts['closed'], 'date' => now()->subDays(6)->setTime(11, 40)],
            ['receipt' => 'DEMO-0003', 'sku' => 'AUD-001', 'qty' => 1, 'customer' => $customers[2], 'method' => 'card', 'cashier' => $cashier, 'shift' => $shifts['closed'], 'date' => now()->subDays(6)->setTime(15, 5)],
            ['receipt' => 'DEMO-0004', 'sku' => 'LAP-001', 'qty' => 1, 'customer' => $customers[3], 'method' => 'bank_transfer', 'cashier' => $owner, 'shift' => null, 'date' => now()->subDays(4)->setTime(10, 0)],
            ['receipt' => 'DEMO-0005', 'sku' => 'SMT-003', 'qty' => 2, 'customer' => $customers[0], 'method' => 'mobile_money', 'cashier' => $cashier, 'shift' => null, 'date' => now()->subDays(3)->setTime(13, 20)],
            ['receipt' => 'DEMO-0006', 'sku' => 'TVH-001', 'qty' => 1, 'customer' => $customers[4], 'method' => 'bank_transfer', 'cashier' => $owner, 'shift' => null, 'date' => now()->subDays(2)->setTime(16, 45)],
            ['receipt' => 'DEMO-0007', 'sku' => 'PWR-003', 'qty' => 4, 'customer' => $customers[2], 'method' => 'cash', 'cashier' => $cashier, 'shift' => $shifts['open'], 'date' => now()->subHours(2)],
            ['receipt' => 'DEMO-0008', 'sku' => 'AUD-002', 'qty' => 1, 'customer' => $customers[1], 'method' => 'mobile_money', 'cashier' => $cashier, 'shift' => $shifts['open'], 'date' => now()->subHour()],
        ];

        return collect($rows)->mapWithKeys(function (array $row) use ($businessId, $branchId, $products, $paymentMethods) {
            $existing = Sale::where('business_id', $businessId)->where('receipt_number', $row['receipt'])->first();
            if ($existing) {
                return [$row['receipt'] => $existing];
            }

            $product = $products[$row['sku']];
            $total = (float) $product->selling_price * $row['qty'];

            $sale = Sale::create([
                'business_id' => $businessId,
                'branch_id' => $branchId,
                'cashier_id' => $row['cashier']->id,
                'shift_id' => $row['shift']?->id,
                'customer_id' => $row['customer']->id,
                'customer_name' => $row['customer']->name,
                'customer_phone' => $row['customer']->phone,
                'receipt_number' => $row['receipt'],
                'status' => 'completed',
                'subtotal' => $total,
                'grand_total' => $total,
                'amount_paid' => $total,
                'currency' => 'TZS',
                'receipt_verification_token' => Str::random(48),
                'completed_at' => $row['date'],
                'created_at' => $row['date'],
                'updated_at' => $row['date'],
            ]);

            SaleItem::create([
                'business_id' => $businessId,
                'sale_id' => $sale->id,
                'product_id' => $product->id,
                'product_name' => $product->name,
                'sku' => $product->sku,
                'quantity' => $row['qty'],
                'unit_price' => $product->selling_price,
                'cost_price' => $product->cost_price,
                'line_total' => $total,
            ]);

            Payment::create([
                'business_id' => $businessId,
                'sale_id' => $sale->id,
                'payment_method_id' => $paymentMethods[$row['method']]->id,
                'amount' => $total,
                'reference' => $row['method'] === 'mobile_money' ? 'MPESA-'.strtoupper(Str::random(8)) : null,
                'received_by' => $row['cashier']->id,
            ]);

            return [$row['receipt'] => $sale];
        });
    }

    private function purchasing(int $businessId, int $branchId, User $owner, $suppliers, $products, $paymentMethods): void
    {
        // Purchase 1: phones from Mlimani, fully received, partially paid, one unit returned.
        $supplier1 = $suppliers['Mlimani Electronics Distributors'];
        $product1 = $products['SMT-001'];

        $order1 = PurchaseOrder::firstOrCreate(
            ['business_id' => $businessId, 'order_number' => 'PO-ME-0001'],
            ['branch_id' => $branchId, 'supplier_id' => $supplier1->id, 'status' => 'converted', 'notes' => 'Restock Galaxy A15', 'created_by' => $owner->id],
        );
        PurchaseOrderItem::firstOrCreate(
            ['business_id' => $businessId, 'purchase_order_id' => $order1->id, 'product_id' => $product1->id],
            ['quantity_ordered' => 20, 'unit_cost' => 380000],
        );
        $purchase1 = Purchase::firstOrCreate(
            ['business_id' => $businessId, 'purchase_number' => 'PUR-ME-0001'],
            [
                'branch_id' => $branchId, 'supplier_id' => $supplier1->id, 'purchase_order_id' => $order1->id,
                'status' => 'received', 'subtotal' => 7600000, 'tax_total' => 0, 'grand_total' => 7600000,
                'amount_paid' => 5000000, 'notes' => 'Received in full, partial payment made',
                'received_by' => $owner->id, 'received_at' => now()->subDays(9),
            ],
        );
        $item1 = PurchaseItem::firstOrCreate(
            ['business_id' => $businessId, 'purchase_id' => $purchase1->id, 'product_id' => $product1->id],
            ['quantity_ordered' => 20, 'quantity_received' => 20, 'unit_cost' => 380000, 'tax_amount' => 0, 'line_total' => 7600000, 'batch_number' => 'SMT001-JUL26-A', 'expiry_date' => null],
        );
        ProductBatch::firstOrCreate(
            ['business_id' => $businessId, 'product_id' => $product1->id, 'branch_id' => $branchId, 'batch_number' => 'SMT001-JUL26-A'],
            ['manufactured_at' => null, 'expiry_date' => null, 'quantity_received' => 20, 'quantity_remaining' => 20, 'purchase_item_id' => $item1->id],
        );
        SupplierPayment::firstOrCreate(
            ['business_id' => $businessId, 'purchase_id' => $purchase1->id, 'reference' => 'SUP-PAY-ME-0001'],
            ['supplier_id' => $supplier1->id, 'amount' => 5000000, 'payment_method_id' => $paymentMethods['bank_transfer']->id, 'paid_by' => $owner->id],
        );
        $return1 = PurchaseReturn::firstOrCreate(
            ['business_id' => $businessId, 'return_number' => 'PR-ME-0001'],
            ['purchase_id' => $purchase1->id, 'total' => 380000, 'reason' => 'One unit arrived with a cracked screen', 'created_by' => $owner->id],
        );
        PurchaseReturnItem::firstOrCreate(
            ['business_id' => $businessId, 'purchase_return_id' => $return1->id, 'purchase_item_id' => $item1->id],
            ['product_id' => $product1->id, 'quantity' => 1, 'unit_cost' => 380000, 'line_total' => 380000],
        );

        // Purchase 2: laptops from TechHub, fully received and fully paid.
        $supplier2 = $suppliers['TechHub East Africa Ltd'];
        $product2 = $products['LAP-001'];

        $order2 = PurchaseOrder::firstOrCreate(
            ['business_id' => $businessId, 'order_number' => 'PO-ME-0002'],
            ['branch_id' => $branchId, 'supplier_id' => $supplier2->id, 'status' => 'converted', 'notes' => 'Restock HP Pavilion 15', 'created_by' => $owner->id],
        );
        PurchaseOrderItem::firstOrCreate(
            ['business_id' => $businessId, 'purchase_order_id' => $order2->id, 'product_id' => $product2->id],
            ['quantity_ordered' => 8, 'unit_cost' => 1180000],
        );
        $purchase2 = Purchase::firstOrCreate(
            ['business_id' => $businessId, 'purchase_number' => 'PUR-ME-0002'],
            [
                'branch_id' => $branchId, 'supplier_id' => $supplier2->id, 'purchase_order_id' => $order2->id,
                'status' => 'received', 'subtotal' => 9440000, 'tax_total' => 0, 'grand_total' => 9440000,
                'amount_paid' => 9440000, 'notes' => 'Paid in full on delivery',
                'received_by' => $owner->id, 'received_at' => now()->subDays(5),
            ],
        );
        $item2 = PurchaseItem::firstOrCreate(
            ['business_id' => $businessId, 'purchase_id' => $purchase2->id, 'product_id' => $product2->id],
            ['quantity_ordered' => 8, 'quantity_received' => 8, 'unit_cost' => 1180000, 'tax_amount' => 0, 'line_total' => 9440000, 'batch_number' => 'LAP001-JUL26-A', 'expiry_date' => null],
        );
        ProductBatch::firstOrCreate(
            ['business_id' => $businessId, 'product_id' => $product2->id, 'branch_id' => $branchId, 'batch_number' => 'LAP001-JUL26-A'],
            ['manufactured_at' => null, 'expiry_date' => null, 'quantity_received' => 8, 'quantity_remaining' => 8, 'purchase_item_id' => $item2->id],
        );
        SupplierPayment::firstOrCreate(
            ['business_id' => $businessId, 'purchase_id' => $purchase2->id, 'reference' => 'SUP-PAY-ME-0002'],
            ['supplier_id' => $supplier2->id, 'amount' => 9440000, 'payment_method_id' => $paymentMethods['bank_transfer']->id, 'paid_by' => $owner->id],
        );
    }

    private function stockOperations(int $businessId, int $mainBranchId, int $cityBranchId, User $owner, $products): void
    {
        $transferProduct = $products['SMT-004'];
        $takeProduct = $products['AUD-001'];

        Inventory::firstOrCreate(
            ['business_id' => $businessId, 'product_id' => $transferProduct->id, 'branch_id' => $cityBranchId],
            ['quantity' => 0, 'reorder_level' => 5],
        );

        StockMovement::firstOrCreate(
            ['business_id' => $businessId, 'product_id' => $transferProduct->id, 'branch_id' => $mainBranchId, 'reason' => 'Opening stock intake'],
            ['previous_quantity' => 0, 'quantity_change' => 30, 'new_quantity' => 30, 'type' => 'opening_stock', 'user_id' => $owner->id],
        );

        $transfer = StockTransfer::firstOrCreate(
            ['business_id' => $businessId, 'transfer_number' => 'TR-ME-0001'],
            [
                'from_branch_id' => $mainBranchId, 'to_branch_id' => $cityBranchId, 'status' => 'received',
                'notes' => 'Stock up Kariakoo branch with Infinix Hot 40 units',
                'requested_by' => $owner->id, 'approved_by' => $owner->id, 'received_by' => $owner->id,
                'dispatched_at' => now()->subDays(2), 'received_at' => now()->subDays(2)->addHours(3),
            ],
        );
        StockTransferItem::firstOrCreate(
            ['business_id' => $businessId, 'stock_transfer_id' => $transfer->id, 'product_id' => $transferProduct->id],
            ['quantity' => 10],
        );

        $stockTake = StockTake::firstOrCreate(
            ['business_id' => $businessId, 'branch_id' => $mainBranchId, 'notes' => 'Monthly stock count — audio accessories'],
            ['status' => 'approved', 'created_by' => $owner->id, 'approved_by' => $owner->id, 'approved_at' => now()->subDay()],
        );
        StockTakeItem::firstOrCreate(
            ['business_id' => $businessId, 'stock_take_id' => $stockTake->id, 'product_id' => $takeProduct->id],
            ['system_quantity' => 18, 'counted_quantity' => 17],
        );
    }

    private function customerFinancials(int $businessId, $customers, $sales, $paymentMethods, User $owner): void
    {
        CustomerPayment::firstOrCreate(
            ['business_id' => $businessId, 'customer_id' => $customers[3]->id, 'reference' => 'CUS-PAY-ME-0001'],
            ['sale_id' => null, 'amount' => 250000, 'payment_method_id' => $paymentMethods['bank_transfer']->id, 'received_by' => $owner->id],
        );
        CustomerPayment::firstOrCreate(
            ['business_id' => $businessId, 'customer_id' => $customers[4]->id, 'reference' => 'CUS-PAY-ME-0002'],
            ['sale_id' => null, 'amount' => 400000, 'payment_method_id' => $paymentMethods['mobile_money']->id, 'received_by' => $owner->id],
        );

        $rewardSale = $sales['DEMO-0001'];
        LoyaltyTransaction::firstOrCreate(
            ['business_id' => $businessId, 'customer_id' => $customers[0]->id, 'sale_id' => $rewardSale->id, 'type' => 'earned'],
            ['points' => 46, 'notes' => 'Points earned on Galaxy A15 purchase'],
        );

        $returnSale = $sales['DEMO-0007'];
        $returnItem = $returnSale->items()->firstOrFail();
        $saleReturn = SaleReturn::firstOrCreate(
            ['business_id' => $businessId, 'return_number' => 'SR-ME-0001'],
            [
                'sale_id' => $returnSale->id, 'total_refund' => $returnItem->unit_price,
                'refund_payment_method_id' => $paymentMethods['cash']->id,
                'reason' => 'Customer returned one faulty USB-C cable', 'created_by' => $owner->id,
            ],
        );
        SaleReturnItem::firstOrCreate(
            ['business_id' => $businessId, 'sale_return_id' => $saleReturn->id, 'sale_item_id' => $returnItem->id],
            ['product_id' => $returnItem->product_id, 'quantity' => 1, 'unit_price' => $returnItem->unit_price, 'line_total' => $returnItem->unit_price, 'condition' => 'damaged'],
        );
    }

    private function quotations(int $businessId, int $branchId, User $owner, $customers, $products): void
    {
        $laptop = $products['LAP-002'];
        $quotation1 = Quotation::firstOrCreate(
            ['business_id' => $businessId, 'quotation_number' => 'QT-ME-0001'],
            [
                'branch_id' => $branchId, 'customer_id' => $customers[3]->id, 'customer_name' => $customers[3]->name,
                'status' => 'sent', 'subtotal' => $laptop->selling_price * 5, 'discount_total' => 0, 'tax_total' => 0,
                'grand_total' => $laptop->selling_price * 5, 'valid_until' => now()->addDays(14)->toDateString(),
                'notes' => 'Bulk quote for office laptop refresh', 'created_by' => $owner->id,
            ],
        );
        QuotationItem::firstOrCreate(
            ['business_id' => $businessId, 'quotation_id' => $quotation1->id, 'product_id' => $laptop->id],
            ['product_name' => $laptop->name, 'quantity' => 5, 'unit_price' => $laptop->selling_price, 'discount_amount' => 0, 'tax_amount' => 0, 'line_total' => $laptop->selling_price * 5],
        );

        $tv = $products['TVH-002'];
        $quotation2 = Quotation::firstOrCreate(
            ['business_id' => $businessId, 'quotation_number' => 'QT-ME-0002'],
            [
                'branch_id' => $branchId, 'customer_id' => $customers[4]->id, 'customer_name' => $customers[4]->name,
                'status' => 'draft', 'subtotal' => $tv->selling_price * 2, 'discount_total' => 100000, 'tax_total' => 0,
                'grand_total' => ($tv->selling_price * 2) - 100000, 'valid_until' => now()->addDays(10)->toDateString(),
                'notes' => 'Boardroom TV upgrade — awaiting approval', 'created_by' => $owner->id,
            ],
        );
        QuotationItem::firstOrCreate(
            ['business_id' => $businessId, 'quotation_id' => $quotation2->id, 'product_id' => $tv->id],
            ['product_name' => $tv->name, 'quantity' => 2, 'unit_price' => $tv->selling_price, 'discount_amount' => 100000, 'tax_amount' => 0, 'line_total' => ($tv->selling_price * 2) - 100000],
        );
    }

    private function expenses(int $businessId, int $branchId, User $owner, $paymentMethods): void
    {
        $categories = collect(['Rent & Utilities', 'Marketing', 'Staff Salaries', 'Internet & Communication'])
            ->mapWithKeys(fn (string $name) => [$name => ExpenseCategory::firstOrCreate(['business_id' => $businessId, 'name' => $name])]);

        $rows = [
            ['category' => 'Rent & Utilities', 'description' => 'Kariakoo shop rent - monthly', 'amount' => 850000, 'date' => now()->subDays(10), 'method' => 'bank_transfer'],
            ['category' => 'Rent & Utilities', 'description' => 'TANESCO electricity bill', 'amount' => 145000, 'date' => now()->subDays(4), 'method' => 'mobile_money'],
            ['category' => 'Marketing', 'description' => 'Instagram & Facebook ads boost', 'amount' => 120000, 'date' => now()->subDays(6), 'method' => 'mobile_money'],
            ['category' => 'Staff Salaries', 'description' => 'Staff salaries - current month', 'amount' => 1400000, 'date' => now()->subDays(2), 'method' => 'bank_transfer'],
            ['category' => 'Internet & Communication', 'description' => 'Office WiFi and airtime', 'amount' => 65000, 'date' => now()->subDay(), 'method' => 'cash'],
        ];

        foreach ($rows as $row) {
            Expense::firstOrCreate(
                ['business_id' => $businessId, 'expense_category_id' => $categories[$row['category']]->id, 'description' => $row['description']],
                [
                    'branch_id' => $branchId, 'amount' => $row['amount'], 'date' => $row['date']->toDateString(),
                    'payment_method_id' => $paymentMethods[$row['method']]->id, 'created_by' => $owner->id,
                ],
            );
        }
    }

    private function notifications(int $businessId, $products): void
    {
        BusinessNotification::firstOrCreate(
            ['business_id' => $businessId, 'type' => 'low_stock', 'title' => 'Low stock: Sony 55" 4K UHD TV'],
            ['message' => 'Only 4 units left of Sony 55" 4K UHD TV — at or near reorder level.', 'read_at' => null],
        );
        BusinessNotification::firstOrCreate(
            ['business_id' => $businessId, 'type' => 'low_stock', 'title' => 'Low stock: Canon EOS 2000D DSLR Kit'],
            ['message' => 'Only 5 units left of Canon EOS 2000D DSLR Kit — at or near reorder level.', 'read_at' => now()->subHours(5)],
        );
        BusinessNotification::firstOrCreate(
            ['business_id' => $businessId, 'type' => 'stock_take', 'title' => 'Stock take approved'],
            ['message' => 'Monthly stock count for audio accessories was approved with a 1-unit shortfall on JBL Flip 6.', 'read_at' => null],
        );
    }
}
