<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\Brand;
use App\Models\Business;
use App\Models\BusinessNotification;
use App\Models\BusinessSetting;
use App\Models\CashierShift;
use App\Models\Customer;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\Inventory;
use App\Models\PaymentMethod;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\Purchase;
use App\Models\PurchaseItem;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\Quotation;
use App\Models\QuotationItem;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\StockTake;
use App\Models\StockTakeItem;
use App\Models\StockTransfer;
use App\Models\StockTransferItem;
use App\Models\Supplier;
use App\Models\Unit;
use App\Models\User;
use App\Services\Staff\StaffService;
use App\Support\Tenancy\BusinessContext;
use Illuminate\Database\Seeder;

/**
 * Fills out every module for the existing "MODERN ELECTRONIC" business (id lookup by
 * slug, not hardcoded) with data that actually matches an electronics retailer — the
 * original DemoBusinessSeeder gave it generic grocery items. Additive only: every
 * write is keyed so re-running this doesn't duplicate rows, and nothing already
 * present (existing products, sales, staff) is touched or deleted.
 */
class ModernElectronicEnrichmentSeeder extends Seeder
{
    private int $businessId;

    private int $mainBranchId;

    private int $cityBranchId;

    private User $owner;

    public function run(): void
    {
        $business = Business::where('slug', 'modern-electronic')->firstOrFail();
        $this->businessId = $business->id;

        BusinessContext::set($this->businessId);

        try {
            $this->owner = User::findOrFail($business->owner_user_id);
            $this->mainBranchId = Branch::where('business_id', $this->businessId)->where('is_main', true)->value('id');
            $this->cityBranchId = Branch::where('business_id', $this->businessId)->where('is_main', false)->value('id')
                ?? $this->mainBranchId;

            $this->enableLoyaltyAndTax();
            $staff = $this->seedStaff();
            $products = $this->seedElectronicsCatalog();
            $suppliers = $this->seedSuppliers();
            $this->seedPurchasing($suppliers, $products);
            $this->seedStockOps($products);
            $customers = $this->seedCustomers();
            $this->seedSales($staff, $customers, $products);
            $this->seedQuotations($customers, $products);
            $this->seedExpenses();
            $this->seedNotifications();
        } finally {
            BusinessContext::set(null);
        }
    }

    private function enableLoyaltyAndTax(): void
    {
        BusinessSetting::where('business_id', $this->businessId)->update([
            'loyalty_enabled' => true,
            'loyalty_spend_per_point' => 10000,
            'loyalty_point_value' => 50,
            'default_tax_rate' => 18,
            'receipt_footer_text' => 'Thank you for shopping at Modern Electronic!',
        ]);
    }

    /** @return array<int,User> keyed by role name */
    private function seedStaff(): array
    {
        $service = app(StaffService::class);
        $roster = [
            'Store Manager' => ['name' => 'Aisha Kombo', 'email' => 'aisha.manager@modernelectronic.test', 'role' => 'Manager', 'branch_id' => $this->mainBranchId, 'job_title' => 'Store Manager'],
            'Cashier One' => ['name' => 'Baraka Mushi', 'email' => 'baraka.cashier@modernelectronic.test', 'role' => 'Cashier', 'branch_id' => $this->mainBranchId, 'job_title' => 'Cashier'],
            'Cashier Two' => ['name' => 'Grace Kileo', 'email' => 'grace.cashier@modernelectronic.test', 'role' => 'Cashier', 'branch_id' => $this->cityBranchId, 'job_title' => 'Cashier'],
            'Storekeeper' => ['name' => 'Emmanuel Shayo', 'email' => 'emmanuel.store@modernelectronic.test', 'role' => 'Storekeeper', 'branch_id' => $this->mainBranchId, 'job_title' => 'Storekeeper'],
        ];

        $users = [];
        foreach ($roster as $key => $data) {
            $existing = User::where('business_id', $this->businessId)->where('email', $data['email'])->first();
            if ($existing) {
                $users[$key] = $existing;

                continue;
            }

            [$user] = $service->create([
                'name' => $data['name'],
                'email' => $data['email'],
                'branch_id' => $data['branch_id'],
                'job_title' => $data['job_title'],
                'password' => 'Password123!',
                'roles' => [$data['role']],
            ], $this->owner);

            $users[$key] = $user;
        }

        return $users;
    }

    /** @return array<string,Product> products keyed by SKU */
    private function seedElectronicsCatalog(): array
    {
        $categories = collect([
            'Phones & Accessories',
            'Audio & Entertainment',
            'Computing',
            'Home Appliances',
            'Cables & Power',
        ])->mapWithKeys(fn (string $name) => [
            $name => ProductCategory::firstOrCreate(['business_id' => $this->businessId, 'parent_id' => null, 'name' => $name]),
        ]);

        $brands = collect(['Samsung', 'Apple', 'Sony', 'Tecno', 'Infinix', 'HP', 'Anker'])
            ->mapWithKeys(fn (string $name) => [$name => Brand::firstOrCreate(['business_id' => $this->businessId, 'name' => $name])]);

        $unit = Unit::firstOrCreate(['business_id' => $this->businessId, 'name' => 'Piece'], ['short_name' => 'pc']);

        $items = [
            ['sku' => 'ELE-PHN-001', 'name' => 'Samsung Galaxy A15', 'category' => 'Phones & Accessories', 'brand' => 'Samsung', 'cost' => 280000, 'price' => 349000, 'stock_main' => 12, 'stock_city' => 4, 'tax' => 18],
            ['sku' => 'ELE-PHN-002', 'name' => 'Tecno Spark 20', 'category' => 'Phones & Accessories', 'brand' => 'Tecno', 'cost' => 210000, 'price' => 269000, 'stock_main' => 15, 'stock_city' => 6, 'tax' => 18],
            ['sku' => 'ELE-PHN-003', 'name' => 'Infinix Hot 40', 'category' => 'Phones & Accessories', 'brand' => 'Infinix', 'cost' => 190000, 'price' => 245000, 'stock_main' => 10, 'stock_city' => 3, 'tax' => 18],
            ['sku' => 'ELE-AUD-001', 'name' => 'Sony WH-CH520 Headphones', 'category' => 'Audio & Entertainment', 'brand' => 'Sony', 'cost' => 45000, 'price' => 69000, 'stock_main' => 20, 'stock_city' => 8, 'tax' => 18],
            ['sku' => 'ELE-AUD-002', 'name' => 'JBL Go 3 Bluetooth Speaker', 'category' => 'Audio & Entertainment', 'brand' => null, 'cost' => 38000, 'price' => 58000, 'stock_main' => 18, 'stock_city' => 5, 'tax' => 18],
            ['sku' => 'ELE-COM-001', 'name' => 'HP 15 Laptop (i3, 8GB)', 'category' => 'Computing', 'brand' => 'HP', 'cost' => 950000, 'price' => 1150000, 'stock_main' => 6, 'stock_city' => 2, 'tax' => 18],
            ['sku' => 'ELE-COM-002', 'name' => 'Wireless Mouse', 'category' => 'Computing', 'brand' => null, 'cost' => 8000, 'price' => 15000, 'stock_main' => 30, 'stock_city' => 10, 'tax' => 18],
            ['sku' => 'ELE-HOM-001', 'name' => '32" LED TV', 'category' => 'Home Appliances', 'brand' => 'Samsung', 'cost' => 320000, 'price' => 399000, 'stock_main' => 8, 'stock_city' => 3, 'tax' => 18],
            ['sku' => 'ELE-HOM-002', 'name' => 'Electric Kettle 1.7L', 'category' => 'Home Appliances', 'brand' => null, 'cost' => 22000, 'price' => 35000, 'stock_main' => 14, 'stock_city' => 5, 'tax' => 18],
            ['sku' => 'ELE-CAB-001', 'name' => 'Anker 20W USB-C Charger', 'category' => 'Cables & Power', 'brand' => 'Anker', 'cost' => 15000, 'price' => 25000, 'stock_main' => 40, 'stock_city' => 15, 'tax' => 18],
            ['sku' => 'ELE-CAB-002', 'name' => 'USB-C Charging Cable 1m', 'category' => 'Cables & Power', 'brand' => null, 'cost' => 4000, 'price' => 8000, 'stock_main' => 60, 'stock_city' => 20, 'tax' => 18],
        ];

        $products = [];
        foreach ($items as $data) {
            $product = Product::updateOrCreate(
                ['business_id' => $this->businessId, 'sku' => $data['sku']],
                [
                    'category_id' => $categories[$data['category']]->id,
                    'brand_id' => $data['brand'] ? $brands[$data['brand']]->id : null,
                    'unit_id' => $unit->id,
                    'name' => $data['name'],
                    'cost_price' => $data['cost'],
                    'selling_price' => $data['price'],
                    'wholesale_price' => $data['price'] - ($data['price'] * 0.05),
                    'minimum_selling_price' => $data['cost'] * 1.05,
                    'tax_rate' => $data['tax'],
                    'is_tax_inclusive' => false,
                    'reorder_level' => 5,
                    'max_stock_level' => 100,
                    'shelf_location' => 'E-'.$data['sku'],
                    'status' => 'active',
                    'created_by' => $this->owner->id,
                ],
            );

            Inventory::updateOrCreate(
                ['business_id' => $this->businessId, 'product_id' => $product->id, 'branch_id' => $this->mainBranchId],
                ['quantity' => $data['stock_main'], 'reorder_level' => 5],
            );
            Inventory::updateOrCreate(
                ['business_id' => $this->businessId, 'product_id' => $product->id, 'branch_id' => $this->cityBranchId],
                ['quantity' => $data['stock_city'], 'reorder_level' => 3],
            );

            $products[$data['sku']] = $product;
        }

        return $products;
    }

    /** @return array<string,Supplier> */
    private function seedSuppliers(): array
    {
        return collect([
            ['name' => 'Dar Electronics Wholesale', 'contact_person' => 'Peter Massawe', 'phone' => '+255 715 662 108'],
            ['name' => 'TechImports East Africa', 'contact_person' => 'Fatma Rajabu', 'phone' => '+255 767 220 991'],
        ])->mapWithKeys(fn (array $data) => [
            $data['name'] => Supplier::firstOrCreate(['business_id' => $this->businessId, 'name' => $data['name']], $data),
        ])->all();
    }

    /** @param array<string,Supplier> $suppliers @param array<string,Product> $products */
    private function seedPurchasing(array $suppliers, array $products): void
    {
        $supplier = $suppliers['Dar Electronics Wholesale'];
        $laptop = $products['ELE-COM-001'];
        $phone = $products['ELE-PHN-002'];

        // A converted-and-received purchase order/purchase for laptops.
        $order = PurchaseOrder::firstOrCreate(
            ['business_id' => $this->businessId, 'order_number' => 'PO-ELEC-0001'],
            ['branch_id' => $this->mainBranchId, 'supplier_id' => $supplier->id, 'status' => 'converted', 'notes' => 'Laptop restock', 'created_by' => $this->owner->id],
        );
        PurchaseOrderItem::firstOrCreate(
            ['business_id' => $this->businessId, 'purchase_order_id' => $order->id, 'product_id' => $laptop->id],
            ['quantity_ordered' => 6, 'unit_cost' => $laptop->cost_price],
        );
        $purchase = Purchase::firstOrCreate(
            ['business_id' => $this->businessId, 'purchase_number' => 'PUR-ELEC-0001'],
            [
                'branch_id' => $this->mainBranchId, 'supplier_id' => $supplier->id, 'purchase_order_id' => $order->id,
                'status' => 'received', 'subtotal' => $laptop->cost_price * 6, 'tax_total' => 0,
                'grand_total' => $laptop->cost_price * 6, 'amount_paid' => $laptop->cost_price * 6,
                'notes' => 'Received in full', 'received_by' => $this->owner->id, 'received_at' => now()->subDays(5),
            ],
        );
        PurchaseItem::firstOrCreate(
            ['business_id' => $this->businessId, 'purchase_id' => $purchase->id, 'product_id' => $laptop->id],
            ['quantity_ordered' => 6, 'quantity_received' => 6, 'unit_cost' => $laptop->cost_price, 'tax_amount' => 0, 'line_total' => $laptop->cost_price * 6],
        );

        // A still-open (pending) purchase order for phones, to show the "awaiting delivery" state.
        $pendingOrder = PurchaseOrder::firstOrCreate(
            ['business_id' => $this->businessId, 'order_number' => 'PO-ELEC-0002'],
            ['branch_id' => $this->mainBranchId, 'supplier_id' => $suppliers['TechImports East Africa']->id, 'status' => 'sent', 'notes' => 'Phone restock, awaiting delivery', 'created_by' => $this->owner->id],
        );
        PurchaseOrderItem::firstOrCreate(
            ['business_id' => $this->businessId, 'purchase_order_id' => $pendingOrder->id, 'product_id' => $phone->id],
            ['quantity_ordered' => 20, 'unit_cost' => $phone->cost_price],
        );
    }

    /** @param array<string,Product> $products */
    private function seedStockOps(array $products): void
    {
        $tv = $products['ELE-HOM-001'];

        $transfer = StockTransfer::firstOrCreate(
            ['business_id' => $this->businessId, 'transfer_number' => 'TR-ELEC-0001'],
            [
                'from_branch_id' => $this->mainBranchId, 'to_branch_id' => $this->cityBranchId, 'status' => 'received',
                'notes' => 'Balance TV stock to City Branch', 'requested_by' => $this->owner->id,
                'approved_by' => $this->owner->id, 'received_by' => $this->owner->id,
                'dispatched_at' => now()->subDays(3), 'received_at' => now()->subDays(2),
            ],
        );
        StockTransferItem::firstOrCreate(
            ['business_id' => $this->businessId, 'stock_transfer_id' => $transfer->id, 'product_id' => $tv->id],
            ['quantity' => 2],
        );

        $stockTake = StockTake::firstOrCreate(
            ['business_id' => $this->businessId, 'branch_id' => $this->mainBranchId, 'notes' => 'Electronics monthly count'],
            ['status' => 'approved', 'created_by' => $this->owner->id, 'approved_by' => $this->owner->id, 'approved_at' => now()->subDay()],
        );
        StockTakeItem::firstOrCreate(
            ['business_id' => $this->businessId, 'stock_take_id' => $stockTake->id, 'product_id' => $tv->id],
            ['system_quantity' => 8, 'counted_quantity' => 7],
        );
    }

    /** @return array<int,Customer> */
    private function seedCustomers(): array
    {
        return collect([
            ['name' => 'David Mwakalinga', 'phone' => '+255 713 990 221', 'email' => 'david.mwakalinga@example.test', 'customer_type' => 'retail', 'loyalty_points' => 24],
            ['name' => 'Zawadi Electronics Kiosk', 'phone' => '+255 655 340 187', 'email' => 'zawadi.kiosk@example.test', 'customer_type' => 'wholesale', 'credit_limit' => 500000, 'loyalty_points' => 0],
            ['name' => 'Happiness Mrema', 'phone' => '+255 786 552 903', 'email' => 'happiness.mrema@example.test', 'customer_type' => 'retail', 'loyalty_points' => 8],
        ])->map(fn (array $data) => Customer::updateOrCreate(
            ['business_id' => $this->businessId, 'phone' => $data['phone']],
            $data,
        ))->all();
    }

    /** @param array<string,User> $staff @param array<int,Customer> $customers @param array<string,Product> $products */
    private function seedSales(array $staff, array $customers, array $products): void
    {
        $cash = PaymentMethod::where('business_id', $this->businessId)->where('type', 'cash')->firstOrFail();
        $mobileMoney = PaymentMethod::where('business_id', $this->businessId)->where('type', 'mobile_money')->firstOrFail();
        $card = PaymentMethod::where('business_id', $this->businessId)->where('type', 'card')->firstOrFail();

        $plan = [
            ['receipt' => 'ELEC-SALE-0001', 'cashier' => $staff['Cashier One'], 'customer' => $customers[0], 'sku' => 'ELE-PHN-001', 'qty' => 1, 'method' => $mobileMoney, 'days_ago' => 6, 'discount' => 0],
            ['receipt' => 'ELEC-SALE-0002', 'cashier' => $staff['Cashier One'], 'customer' => null, 'sku' => 'ELE-CAB-001', 'qty' => 3, 'method' => $cash, 'days_ago' => 5, 'discount' => 0],
            ['receipt' => 'ELEC-SALE-0003', 'cashier' => $staff['Cashier Two'], 'customer' => $customers[2], 'sku' => 'ELE-AUD-001', 'qty' => 1, 'method' => $card, 'days_ago' => 4, 'discount' => 5000],
            ['receipt' => 'ELEC-SALE-0004', 'cashier' => $staff['Store Manager'], 'customer' => $customers[1], 'sku' => 'ELE-COM-001', 'qty' => 2, 'method' => $mobileMoney, 'days_ago' => 3, 'discount' => 0],
            ['receipt' => 'ELEC-SALE-0005', 'cashier' => $staff['Cashier One'], 'customer' => null, 'sku' => 'ELE-HOM-002', 'qty' => 1, 'method' => $cash, 'days_ago' => 2, 'discount' => 0],
            ['receipt' => 'ELEC-SALE-0006', 'cashier' => $staff['Cashier Two'], 'customer' => $customers[0], 'sku' => 'ELE-PHN-003', 'qty' => 1, 'method' => $mobileMoney, 'days_ago' => 1, 'discount' => 0],
            ['receipt' => 'ELEC-SALE-0007', 'cashier' => $staff['Cashier One'], 'customer' => null, 'sku' => 'ELE-AUD-002', 'qty' => 2, 'method' => $cash, 'days_ago' => 0, 'discount' => 0],
        ];

        foreach ($plan as $data) {
            if (Sale::where('business_id', $this->businessId)->where('receipt_number', $data['receipt'])->exists()) {
                continue;
            }

            $product = $products[$data['sku']];
            $gross = (float) $product->selling_price * $data['qty'];
            $taxable = $gross - $data['discount'];
            $tax = round($taxable * ((float) $product->tax_rate / 100), 2);
            $total = round($taxable + $tax, 2);
            $when = now()->subDays($data['days_ago']);

            $sale = Sale::create([
                'business_id' => $this->businessId,
                'branch_id' => $this->mainBranchId,
                'cashier_id' => $data['cashier']->id,
                'customer_id' => $data['customer']?->id,
                'customer_name' => $data['customer']?->name ?? 'Walk-in',
                'customer_phone' => $data['customer']?->phone,
                'receipt_number' => $data['receipt'],
                'status' => 'completed',
                'subtotal' => $gross,
                'discount_total' => $data['discount'],
                'tax_total' => $tax,
                'grand_total' => $total,
                'amount_paid' => $total,
                'currency' => 'TZS',
                'receipt_verification_token' => \Illuminate\Support\Str::random(48),
                'completed_at' => $when,
                'created_at' => $when,
                'updated_at' => $when,
            ]);

            SaleItem::create([
                'business_id' => $this->businessId,
                'sale_id' => $sale->id,
                'product_id' => $product->id,
                'product_name' => $product->name,
                'sku' => $product->sku,
                'quantity' => $data['qty'],
                'unit_price' => $product->selling_price,
                'cost_price' => $product->cost_price,
                'discount_amount' => $data['discount'],
                'tax_amount' => $tax,
                'line_total' => $total,
            ]);

            \App\Models\Payment::create([
                'business_id' => $this->businessId,
                'sale_id' => $sale->id,
                'payment_method_id' => $data['method']->id,
                'amount' => $total,
                'reference' => $data['method']->type === 'mobile_money' ? 'MPESA-ELEC-'.$sale->id : null,
                'received_by' => $data['cashier']->id,
            ]);
        }

        // One held (in-progress) sale so the POS "held sales" tray has something to resume.
        $heldReceipt = 'PENDING-ELEC-HOLD-0001';
        if (! Sale::where('business_id', $this->businessId)->where('receipt_number', $heldReceipt)->exists()) {
            $mouse = $products['ELE-COM-002'];
            $heldSale = Sale::create([
                'business_id' => $this->businessId,
                'branch_id' => $this->mainBranchId,
                'cashier_id' => $staff['Cashier One']->id,
                'customer_name' => 'Walk-in',
                'receipt_number' => $heldReceipt,
                'status' => 'held',
                'subtotal' => $mouse->selling_price * 2,
                'discount_total' => 0,
                'tax_total' => 0,
                'grand_total' => $mouse->selling_price * 2,
                'amount_paid' => 0,
                'currency' => 'TZS',
            ]);
            SaleItem::create([
                'business_id' => $this->businessId,
                'sale_id' => $heldSale->id,
                'product_id' => $mouse->id,
                'product_name' => $mouse->name,
                'sku' => $mouse->sku,
                'quantity' => 2,
                'unit_price' => $mouse->selling_price,
                'cost_price' => $mouse->cost_price,
                'line_total' => $mouse->selling_price * 2,
            ]);
        }

        // A closed shift for one of the new cashiers, for shift-history/reporting.
        CashierShift::firstOrCreate(
            ['business_id' => $this->businessId, 'branch_id' => $this->mainBranchId, 'user_id' => $staff['Cashier One']->id, 'opened_at' => now()->subDays(2)->startOfDay()],
            ['opening_cash' => 30000, 'closing_cash' => 30000, 'expected_cash' => 30000, 'difference' => 0, 'status' => 'closed', 'closed_at' => now()->subDays(2)->endOfDay(), 'notes' => 'Enrichment demo shift'],
        );
    }

    /** @param array<int,Customer> $customers @param array<string,Product> $products */
    private function seedQuotations(array $customers, array $products): void
    {
        $laptop = $products['ELE-COM-001'];
        $tv = $products['ELE-HOM-001'];

        $sent = Quotation::firstOrCreate(
            ['business_id' => $this->businessId, 'quotation_number' => 'QT-ELEC-0001'],
            [
                'branch_id' => $this->mainBranchId, 'customer_id' => $customers[1]->id, 'customer_name' => $customers[1]->name,
                'status' => 'sent', 'subtotal' => $laptop->selling_price * 3, 'discount_total' => 0, 'tax_total' => 0,
                'grand_total' => $laptop->selling_price * 3, 'valid_until' => now()->addDays(10)->toDateString(),
                'notes' => 'Bulk laptop order for shop resale', 'created_by' => $this->owner->id,
            ],
        );
        QuotationItem::firstOrCreate(
            ['business_id' => $this->businessId, 'quotation_id' => $sent->id, 'product_id' => $laptop->id],
            ['product_name' => $laptop->name, 'quantity' => 3, 'unit_price' => $laptop->selling_price, 'discount_amount' => 0, 'tax_amount' => 0, 'line_total' => $laptop->selling_price * 3],
        );

        $expired = Quotation::firstOrCreate(
            ['business_id' => $this->businessId, 'quotation_number' => 'QT-ELEC-0002'],
            [
                'branch_id' => $this->mainBranchId, 'customer_id' => null, 'customer_name' => 'Kilimanjaro Hotel',
                'status' => 'expired', 'subtotal' => $tv->selling_price * 4, 'discount_total' => 0, 'tax_total' => 0,
                'grand_total' => $tv->selling_price * 4, 'valid_until' => now()->subDays(5)->toDateString(),
                'notes' => 'TV supply for hotel rooms - client went quiet', 'created_by' => $this->owner->id,
            ],
        );
        QuotationItem::firstOrCreate(
            ['business_id' => $this->businessId, 'quotation_id' => $expired->id, 'product_id' => $tv->id],
            ['product_name' => $tv->name, 'quantity' => 4, 'unit_price' => $tv->selling_price, 'discount_amount' => 0, 'tax_amount' => 0, 'line_total' => $tv->selling_price * 4],
        );
    }

    private function seedExpenses(): void
    {
        $cash = PaymentMethod::where('business_id', $this->businessId)->where('type', 'cash')->firstOrFail();
        $bank = PaymentMethod::where('business_id', $this->businessId)->where('type', 'bank_transfer')->firstOrFail();

        $categories = collect(['Utilities', 'Marketing', 'Staff Salaries', 'Transport'])
            ->mapWithKeys(fn (string $name) => [$name => ExpenseCategory::firstOrCreate(['business_id' => $this->businessId, 'name' => $name])]);

        $plan = [
            ['category' => 'Utilities', 'description' => 'Electricity bill - August', 'amount' => 95000, 'days_ago' => 6, 'method' => $bank],
            ['category' => 'Marketing', 'description' => 'Facebook ads campaign', 'amount' => 60000, 'days_ago' => 4, 'method' => $bank],
            ['category' => 'Staff Salaries', 'description' => 'Cashier salaries - August', 'amount' => 900000, 'days_ago' => 3, 'method' => $bank],
            ['category' => 'Transport', 'description' => 'Delivery van fuel', 'amount' => 45000, 'days_ago' => 1, 'method' => $cash],
        ];

        foreach ($plan as $data) {
            Expense::firstOrCreate(
                ['business_id' => $this->businessId, 'expense_category_id' => $categories[$data['category']]->id, 'description' => $data['description']],
                [
                    'branch_id' => $this->mainBranchId, 'amount' => $data['amount'], 'date' => now()->subDays($data['days_ago'])->toDateString(),
                    'payment_method_id' => $data['method']->id, 'created_by' => $this->owner->id,
                ],
            );
        }
    }

    private function seedNotifications(): void
    {
        BusinessNotification::firstOrCreate(
            ['business_id' => $this->businessId, 'type' => 'low_stock', 'title' => 'Low stock: laptops'],
            ['message' => 'HP 15 Laptop is approaching its reorder level at City Branch.', 'read_at' => null],
        );
        BusinessNotification::firstOrCreate(
            ['business_id' => $this->businessId, 'type' => 'quotation_expiring', 'title' => 'Quotation expired'],
            ['message' => 'Quotation QT-ELEC-0002 for Kilimanjaro Hotel has expired without a response.', 'read_at' => null],
        );
    }
}
