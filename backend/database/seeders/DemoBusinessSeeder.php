<?php

namespace Database\Seeders;

use App\Models\Customer;
use App\Models\CustomerPayment;
use App\Models\Barcode;
use App\Models\Brand;
use App\Models\BusinessNotification;
use App\Models\CashierShift;
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
use App\Models\Supplier;
use App\Models\SupplierPayment;
use App\Models\StockMovement;
use App\Models\StockTake;
use App\Models\StockTakeItem;
use App\Models\StockTransfer;
use App\Models\StockTransferItem;
use App\Models\Unit;
use App\Models\User;
use App\Services\Business\BusinessRegistrationService;
use App\Support\Tenancy\BusinessContext;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class DemoBusinessSeeder extends Seeder
{
    public function run(): void
    {
        [$business] = $this->business();

        BusinessContext::set($business->id);

        try {
            $this->seedBusiness();
        } finally {
            BusinessContext::set(null);
        }
    }

    private function seedBusiness(): void
    {
        [$business, $owner, $branch] = $this->business();

        $categories = collect([
            'Beverages',
            'Pantry Staples',
            'Household Care',
            'Personal Care',
        ])->mapWithKeys(fn (string $name) => [
            $name => ProductCategory::firstOrCreate([
                'business_id' => $business->id,
                'parent_id' => null,
                'name' => $name,
            ]),
        ]);

        $suppliers = collect([
            ['name' => 'Kilimanjaro Distributors', 'contact_person' => 'Asha Mollel', 'phone' => '+255 754 210 884'],
            ['name' => 'East Africa Home Care', 'contact_person' => 'Daniel Otieno', 'phone' => '+255 713 442 190'],
        ])->mapWithKeys(fn (array $data) => [
            $data['name'] => Supplier::firstOrCreate(
                ['business_id' => $business->id, 'name' => $data['name']],
                $data,
            ),
        ]);

        $products = [
            ['name' => 'Azam Cola 500ml', 'sku' => 'BEV-001', 'category' => 'Beverages', 'supplier' => 'Kilimanjaro Distributors', 'cost_price' => 700, 'selling_price' => 1000, 'stock' => 48],
            ['name' => 'Kilimanjaro Water 1.5L', 'sku' => 'BEV-002', 'category' => 'Beverages', 'supplier' => 'Kilimanjaro Distributors', 'cost_price' => 700, 'selling_price' => 1200, 'stock' => 36],
            ['name' => 'Nescafe Classic 50g', 'sku' => 'PAN-001', 'category' => 'Pantry Staples', 'supplier' => 'Kilimanjaro Distributors', 'cost_price' => 3800, 'selling_price' => 5200, 'stock' => 24],
            ['name' => 'Mchele Mbeya 5kg', 'sku' => 'PAN-002', 'category' => 'Pantry Staples', 'supplier' => 'Kilimanjaro Distributors', 'cost_price' => 11500, 'selling_price' => 14500, 'stock' => 18],
            ['name' => 'Omo Laundry Powder 1kg', 'sku' => 'HOM-001', 'category' => 'Household Care', 'supplier' => 'East Africa Home Care', 'cost_price' => 4200, 'selling_price' => 5600, 'stock' => 20],
            ['name' => 'Sunlight Dishwashing Liquid 750ml', 'sku' => 'HOM-002', 'category' => 'Household Care', 'supplier' => 'East Africa Home Care', 'cost_price' => 2800, 'selling_price' => 3900, 'stock' => 15],
            ['name' => 'Geisha Bathing Soap 175g', 'sku' => 'PER-001', 'category' => 'Personal Care', 'supplier' => 'East Africa Home Care', 'cost_price' => 900, 'selling_price' => 1400, 'stock' => 30],
            ['name' => 'Colgate Toothpaste 100ml', 'sku' => 'PER-002', 'category' => 'Personal Care', 'supplier' => 'East Africa Home Care', 'cost_price' => 2600, 'selling_price' => 3500, 'stock' => 16],
        ];

        foreach ($products as $data) {
            $product = Product::updateOrCreate(
                ['business_id' => $business->id, 'sku' => $data['sku']],
                [
                    'category_id' => $categories[$data['category']]->id,
                    'supplier_id' => $suppliers[$data['supplier']]->id,
                    'name' => $data['name'],
                    'cost_price' => $data['cost_price'],
                    'selling_price' => $data['selling_price'],
                    'wholesale_price' => $data['selling_price'] - 100,
                    'minimum_selling_price' => $data['selling_price'],
                    'reorder_level' => 5,
                    'max_stock_level' => 100,
                    'shelf_location' => 'A-'.$data['sku'],
                    'status' => 'active',
                    'created_by' => $owner->id,
                ],
            );

            Inventory::updateOrCreate(
                ['business_id' => $business->id, 'product_id' => $product->id, 'branch_id' => $branch->id],
                ['quantity' => $data['stock'], 'reorder_level' => 5],
            );
        }

        $customers = collect([
            ['name' => 'Neema Mushi', 'phone' => '+255 716 334 821', 'email' => 'neema.mushi@example.test', 'customer_type' => 'retail'],
            ['name' => 'Mtaa Cafe', 'phone' => '+255 754 901 662', 'email' => 'accounts@mtaacafe.example.test', 'customer_type' => 'wholesale', 'credit_limit' => 150000],
            ['name' => 'Juma Said', 'phone' => '+255 782 118 447', 'email' => 'juma.said@example.test', 'customer_type' => 'retail'],
        ])->map(fn (array $data) => Customer::updateOrCreate(
            ['business_id' => $business->id, 'phone' => $data['phone']],
            $data,
        ));

        $this->sales($business->id, $branch->id, $owner, $customers, $products);
        $secondaryBranch = $this->seedSecondaryBranch($business->id);
        $this->seedCatalog($business->id, $products);
        $this->seedPurchasing($business->id, $branch->id, $owner, $suppliers, $products);
        $this->seedOperations($business->id, $branch->id, $secondaryBranch->id, $owner, $customers, $products);
    }

    private function seedSecondaryBranch(int $businessId): \App\Models\Branch
    {
        return \App\Models\Branch::firstOrCreate(
            ['business_id' => $businessId, 'code' => 'CITY'],
            ['name' => 'City Branch', 'is_main' => false, 'status' => 'active'],
        );
    }

    private function seedCatalog(int $businessId, array $productData): void
    {
        $brands = collect(['Azam', 'Kilimanjaro', 'Nescafe', 'Omo', 'Colgate'])
            ->mapWithKeys(fn (string $name) => [$name => Brand::firstOrCreate(['business_id' => $businessId, 'name' => $name])]);
        $units = collect([
            ['name' => 'Piece', 'short_name' => 'pc'],
            ['name' => 'Kilogram', 'short_name' => 'kg'],
            ['name' => 'Litre', 'short_name' => 'L'],
        ])->mapWithKeys(fn (array $data) => [$data['name'] => Unit::firstOrCreate(['business_id' => $businessId, 'name' => $data['name']], $data)]);

        foreach ($productData as $data) {
            $brandName = collect($brands->keys())->first(fn (string $brand) => str_contains(strtolower($data['name']), strtolower($brand)));
            $unitName = str_contains($data['name'], 'kg') ? 'Kilogram' : (str_contains($data['name'], 'L') ? 'Litre' : 'Piece');
            Product::where('business_id', $businessId)->where('sku', $data['sku'])->update([
                'brand_id' => $brandName ? $brands[$brandName]->id : null,
                'unit_id' => $units[$unitName]->id,
            ]);
            Barcode::firstOrCreate(
                ['business_id' => $businessId, 'code' => '600912345'.str_pad((string) (array_search($data['sku'], array_column($productData, 'sku')) + 1), 3, '0', STR_PAD_LEFT)],
                ['product_id' => Product::where('business_id', $businessId)->where('sku', $data['sku'])->value('id'), 'type' => 'EAN13', 'is_primary' => true],
            );
        }
    }

    private function seedPurchasing(int $businessId, int $branchId, User $owner, $suppliers, array $productData): void
    {
        $supplier = $suppliers['Kilimanjaro Distributors'];
        $product = Product::where('business_id', $businessId)->where('sku', 'BEV-001')->firstOrFail();
        $order = PurchaseOrder::firstOrCreate(
            ['business_id' => $businessId, 'order_number' => 'PO-DEMO-0001'],
            ['branch_id' => $branchId, 'supplier_id' => $supplier->id, 'status' => 'converted', 'notes' => 'Regular beverage restock', 'created_by' => $owner->id],
        );
        PurchaseOrderItem::firstOrCreate(
            ['business_id' => $businessId, 'purchase_order_id' => $order->id, 'product_id' => $product->id],
            ['quantity_ordered' => 60, 'unit_cost' => 700],
        );
        $purchase = Purchase::firstOrCreate(
            ['business_id' => $businessId, 'purchase_number' => 'PUR-DEMO-0001'],
            ['branch_id' => $branchId, 'supplier_id' => $supplier->id, 'purchase_order_id' => $order->id, 'status' => 'received', 'subtotal' => 42000, 'tax_total' => 0, 'grand_total' => 42000, 'amount_paid' => 30000, 'notes' => 'Received in full', 'received_by' => $owner->id, 'received_at' => now()->subDays(3)],
        );
        $item = PurchaseItem::firstOrCreate(
            ['business_id' => $businessId, 'purchase_id' => $purchase->id, 'product_id' => $product->id],
            ['quantity_ordered' => 60, 'quantity_received' => 60, 'unit_cost' => 700, 'tax_amount' => 0, 'line_total' => 42000, 'batch_number' => 'BEV-MAY-26', 'expiry_date' => now()->addMonths(10)->toDateString()],
        );
        ProductBatch::firstOrCreate(
            ['business_id' => $businessId, 'product_id' => $product->id, 'branch_id' => $branchId, 'batch_number' => 'BEV-MAY-26'],
            ['manufactured_at' => now()->subMonth()->toDateString(), 'expiry_date' => now()->addMonths(10)->toDateString(), 'quantity_received' => 60, 'quantity_remaining' => 60, 'purchase_item_id' => $item->id],
        );
        SupplierPayment::firstOrCreate(
            ['business_id' => $businessId, 'purchase_id' => $purchase->id, 'reference' => 'SUP-PAY-DEMO-0001'],
            ['supplier_id' => $supplier->id, 'amount' => 30000, 'payment_method_id' => PaymentMethod::where('business_id', $businessId)->where('type', 'bank_transfer')->value('id'), 'paid_by' => $owner->id],
        );
        $purchaseReturn = PurchaseReturn::firstOrCreate(
            ['business_id' => $businessId, 'return_number' => 'PR-DEMO-0001'],
            ['purchase_id' => $purchase->id, 'total' => 700, 'reason' => 'Damaged unit', 'created_by' => $owner->id],
        );
        PurchaseReturnItem::firstOrCreate(
            ['business_id' => $businessId, 'purchase_return_id' => $purchaseReturn->id, 'purchase_item_id' => $item->id],
            ['product_id' => $product->id, 'quantity' => 1, 'unit_cost' => 700, 'line_total' => 700],
        );
    }

    private function seedOperations(int $businessId, int $branchId, int $secondaryBranchId, User $owner, $customers, array $productData): void
    {
        $product = Product::where('business_id', $businessId)->where('sku', 'PAN-001')->firstOrFail();
        $cashMethod = PaymentMethod::where('business_id', $businessId)->where('type', 'cash')->firstOrFail();
        $sale = Sale::where('business_id', $businessId)->where('receipt_number', 'DEMO-0001')->firstOrFail();
        $shift = CashierShift::firstOrCreate(
            ['business_id' => $businessId, 'branch_id' => $branchId, 'user_id' => $owner->id, 'opened_at' => now()->subDays(2)->startOfDay()],
            ['opening_cash' => 50000, 'closing_cash' => 53000, 'expected_cash' => 53000, 'difference' => 0, 'status' => 'closed', 'closed_at' => now()->subDays(2)->endOfDay(), 'notes' => 'Completed demo shift'],
        );
        $sale->update(['shift_id' => $shift->id, 'customer_id' => $customers[0]->id]);
        Inventory::firstOrCreate(['business_id' => $businessId, 'product_id' => $product->id, 'branch_id' => $secondaryBranchId], ['quantity' => 12, 'reorder_level' => 3]);
        StockMovement::firstOrCreate(
            ['business_id' => $businessId, 'product_id' => $product->id, 'branch_id' => $branchId, 'reason' => 'Demo opening stock'],
            ['previous_quantity' => 0, 'quantity_change' => 24, 'new_quantity' => 24, 'type' => 'opening_stock', 'user_id' => $owner->id],
        );
        $transfer = StockTransfer::firstOrCreate(
            ['business_id' => $businessId, 'transfer_number' => 'TR-DEMO-0001'],
            ['from_branch_id' => $branchId, 'to_branch_id' => $secondaryBranchId, 'status' => 'received', 'notes' => 'Rebalance city stock', 'requested_by' => $owner->id, 'approved_by' => $owner->id, 'received_by' => $owner->id, 'dispatched_at' => now()->subDay(), 'received_at' => now()->subDay()],
        );
        StockTransferItem::firstOrCreate(['business_id' => $businessId, 'stock_transfer_id' => $transfer->id, 'product_id' => $product->id], ['quantity' => 6]);
        $stockTake = StockTake::firstOrCreate(
            ['business_id' => $businessId, 'branch_id' => $branchId, 'notes' => 'Monthly demo count'],
            ['status' => 'approved', 'created_by' => $owner->id, 'approved_by' => $owner->id, 'approved_at' => now()->subDay()],
        );
        StockTakeItem::firstOrCreate(['business_id' => $businessId, 'stock_take_id' => $stockTake->id, 'product_id' => $product->id], ['system_quantity' => 24, 'counted_quantity' => 23]);
        CustomerPayment::firstOrCreate(
            ['business_id' => $businessId, 'customer_id' => $customers[1]->id, 'reference' => 'CUS-PAY-DEMO-0001'],
            ['sale_id' => null, 'amount' => 25000, 'payment_method_id' => PaymentMethod::where('business_id', $businessId)->where('type', 'mobile_money')->value('id'), 'received_by' => $owner->id],
        );
        LoyaltyTransaction::firstOrCreate(['business_id' => $businessId, 'customer_id' => $customers[0]->id, 'sale_id' => $sale->id, 'type' => 'earned'], ['points' => 10, 'notes' => 'Demo purchase reward']);
        $saleItem = $sale->items()->firstOrFail();
        $saleReturn = SaleReturn::firstOrCreate(
            ['business_id' => $businessId, 'return_number' => 'SR-DEMO-0001'],
            ['sale_id' => $sale->id, 'total_refund' => $saleItem->unit_price, 'refund_payment_method_id' => $cashMethod->id, 'reason' => 'Customer returned one item', 'created_by' => $owner->id],
        );
        SaleReturnItem::firstOrCreate(
            ['business_id' => $businessId, 'sale_return_id' => $saleReturn->id, 'sale_item_id' => $saleItem->id],
            ['product_id' => $saleItem->product_id, 'quantity' => 1, 'unit_price' => $saleItem->unit_price, 'line_total' => $saleItem->unit_price, 'condition' => 'sellable'],
        );
        $quotation = Quotation::firstOrCreate(
            ['business_id' => $businessId, 'quotation_number' => 'QT-DEMO-0001'],
            ['branch_id' => $branchId, 'customer_id' => $customers[1]->id, 'customer_name' => $customers[1]->name, 'status' => 'sent', 'subtotal' => 29000, 'discount_total' => 0, 'tax_total' => 0, 'grand_total' => 29000, 'valid_until' => now()->addDays(14)->toDateString(), 'notes' => 'Wholesale electronics and household quotation', 'created_by' => $owner->id],
        );
        QuotationItem::firstOrCreate(['business_id' => $businessId, 'quotation_id' => $quotation->id, 'product_id' => $product->id], ['product_name' => $product->name, 'quantity' => 5, 'unit_price' => $product->selling_price, 'discount_amount' => 0, 'tax_amount' => 0, 'line_total' => $product->selling_price * 5]);
        $expenseCategory = ExpenseCategory::firstOrCreate(['business_id' => $businessId, 'name' => 'Rent and Utilities']);
        Expense::firstOrCreate(['business_id' => $businessId, 'expense_category_id' => $expenseCategory->id, 'description' => 'Shop rent - demo'], ['branch_id' => $branchId, 'amount' => 180000, 'date' => now()->subDays(2)->toDateString(), 'payment_method_id' => $cashMethod->id, 'created_by' => $owner->id]);
        BusinessNotification::firstOrCreate(['business_id' => $businessId, 'type' => 'low_stock', 'title' => 'Low stock alert'], ['message' => 'Nescafe Classic 50g is approaching its reorder level.', 'read_at' => null]);
    }

    private function business(): array
    {
        $business = \App\Models\Business::where('slug', 'modern-electronic')->first();

        if (!$business) {
            return app(BusinessRegistrationService::class)->register([
                'business_name' => 'MODERN ELECTRONIC',
                'owner_name' => 'Modern Electronic Admin',
                'email' => 'admin@modernelectronic.test',
                'password' => 'ChangeMe123!',
            ]);
        }

        return BusinessContext::runAsPlatform(fn () => [
            $business,
            User::where('id', $business->owner_user_id)->firstOrFail(),
            $business->branches()->where('is_main', true)->firstOrFail(),
        ]);
    }

    private function sales(int $businessId, int $branchId, User $owner, $customers, array $productData): void
    {
        $cash = PaymentMethod::where('business_id', $businessId)->where('type', 'cash')->firstOrFail();
        $mobileMoney = PaymentMethod::where('business_id', $businessId)->where('type', 'mobile_money')->firstOrFail();
        $products = Product::where('business_id', $businessId)->whereIn('sku', collect($productData)->pluck('sku'))->get()->keyBy('sku');

        $sales = [
            ['receipt_number' => 'DEMO-0001', 'customer' => $customers[0], 'sku' => 'BEV-001', 'quantity' => 3, 'method' => $cash, 'date' => now()->subDays(2)],
            ['receipt_number' => 'DEMO-0002', 'customer' => $customers[1], 'sku' => 'PAN-002', 'quantity' => 2, 'method' => $mobileMoney, 'date' => now()->subDay()],
            ['receipt_number' => 'DEMO-0003', 'customer' => $customers[2], 'sku' => 'HOM-001', 'quantity' => 1, 'method' => $cash, 'date' => now()],
        ];

        foreach ($sales as $data) {
            if (Sale::where('business_id', $businessId)->where('receipt_number', $data['receipt_number'])->exists()) {
                continue;
            }

            $product = $products[$data['sku']];
            $total = (float) $product->selling_price * $data['quantity'];
            $sale = Sale::create([
                'business_id' => $businessId,
                'branch_id' => $branchId,
                'cashier_id' => $owner->id,
                'customer_name' => $data['customer']->name,
                'customer_phone' => $data['customer']->phone,
                'receipt_number' => $data['receipt_number'],
                'status' => 'completed',
                'subtotal' => $total,
                'grand_total' => $total,
                'amount_paid' => $total,
                'currency' => 'TZS',
                'receipt_verification_token' => Str::random(48),
                'completed_at' => $data['date'],
                'created_at' => $data['date'],
                'updated_at' => $data['date'],
            ]);

            SaleItem::create([
                'business_id' => $businessId,
                'sale_id' => $sale->id,
                'product_id' => $product->id,
                'product_name' => $product->name,
                'sku' => $product->sku,
                'quantity' => $data['quantity'],
                'unit_price' => $product->selling_price,
                'cost_price' => $product->cost_price,
                'line_total' => $total,
            ]);

            Payment::create([
                'business_id' => $businessId,
                'sale_id' => $sale->id,
                'payment_method_id' => $data['method']->id,
                'amount' => $total,
                'reference' => $data['method']->type === 'mobile_money' ? 'MPESA-DEMO-0002' : null,
                'received_by' => $owner->id,
            ]);
        }
    }
}
