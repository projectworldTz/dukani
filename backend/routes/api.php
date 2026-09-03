<?php

use App\Http\Controllers\Api\V1\Audit\AuditLogController;
use App\Http\Controllers\Api\V1\Auth\AuthController;
use App\Http\Controllers\Api\V1\Branches\BranchController;
use App\Http\Controllers\Api\V1\Business\BusinessSettingController;
use App\Http\Controllers\Api\V1\Customers\CustomerController;
use App\Http\Controllers\Api\V1\Expenses\ExpenseCategoryController;
use App\Http\Controllers\Api\V1\Expenses\ExpenseController;
use App\Http\Controllers\Api\V1\Inventory\InventoryController;
use App\Http\Controllers\Api\V1\Notifications\NotificationController;
use App\Http\Controllers\Api\V1\Platform\PlatformController;
use App\Http\Controllers\Api\V1\Platform\PlatformNotificationController;
use App\Http\Controllers\Api\V1\Products\BrandController;
use App\Http\Controllers\Api\V1\Products\ProductBarcodeController;
use App\Http\Controllers\Api\V1\Products\ProductBatchController;
use App\Http\Controllers\Api\V1\Products\ProductCategoryController;
use App\Http\Controllers\Api\V1\Products\ProductController;
use App\Http\Controllers\Api\V1\Products\ScanController;
use App\Http\Controllers\Api\V1\Products\SupplierController;
use App\Http\Controllers\Api\V1\Products\UnitController;
use App\Http\Controllers\Api\V1\Purchasing\PurchaseController;
use App\Http\Controllers\Api\V1\Purchasing\PurchaseOrderController;
use App\Http\Controllers\Api\V1\Purchasing\PurchaseReturnController;
use App\Http\Controllers\Api\V1\Quotations\QuotationController;
use App\Http\Controllers\Api\V1\Rbac\RoleController;
use App\Http\Controllers\Api\V1\Receipts\ReceiptController;
use App\Http\Controllers\Api\V1\Reports\ProfitReportController;
use App\Http\Controllers\Api\V1\Reports\ReportController;
use App\Http\Controllers\Api\V1\Sales\PaymentMethodController;
use App\Http\Controllers\Api\V1\Sales\SaleController;
use App\Http\Controllers\Api\V1\Sales\SaleReturnController;
use App\Http\Controllers\Api\V1\Shifts\ShiftController;
use App\Http\Controllers\Api\V1\Staff\StaffController;
use App\Http\Controllers\Api\V1\StockTaking\StockTakeController;
use App\Http\Controllers\Api\V1\Transfers\StockTransferController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {

    Route::post('/auth/register', [AuthController::class, 'register'])->middleware('throttle:auth-register');
    Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:auth-login');
    Route::post('/auth/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:auth-forgot-password');
    Route::post('/auth/reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:auth-reset-password');
    Route::post('/auth/email/verify', [AuthController::class, 'verifyEmail'])->middleware('throttle:auth-verify-email');
    Route::get('/receipts/verify/{token}', [ReceiptController::class, 'verify'])->middleware('throttle:30,1');

    Route::middleware(['auth:sanctum', 'throttle:api'])->group(function () {
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::get('/auth/me', [AuthController::class, 'me']);
        Route::post('/auth/email/resend', [AuthController::class, 'resendVerificationEmail']);
        Route::get('/auth/sessions', [AuthController::class, 'sessions']);
        Route::delete('/auth/sessions/{tokenId}', [AuthController::class, 'revokeSession']);

        // --- Business / Branches / Staff / RBAC -------------------------------
        Route::get('/business/settings', [BusinessSettingController::class, 'show']);
        Route::put('/business/settings', [BusinessSettingController::class, 'update']);

        Route::apiResource('branches', BranchController::class)->except('destroy');

        Route::apiResource('staff', StaffController::class)->except('destroy')->parameters(['staff' => 'user']);

        Route::get('/roles/permission-catalog', [RoleController::class, 'permissionCatalog']);
        Route::get('/roles', [RoleController::class, 'index']);
        Route::post('/roles', [RoleController::class, 'store']);
        Route::put('/roles/{role}/permissions', [RoleController::class, 'updatePermissions']);
        Route::post('/roles/{role}/limits', [RoleController::class, 'setLimit']);

        // --- Product catalog ---------------------------------------------------
        // Static routes registered before the apiResource so "export"/"import"/"labels"
        // aren't swallowed by the {product} show route's implicit wildcard.
        Route::get('/products/export', [ProductController::class, 'export']);
        Route::post('/products/import', [ProductController::class, 'import']);
        Route::post('/products/labels', [ProductBarcodeController::class, 'labels']);
        Route::apiResource('products', ProductController::class);
        Route::post('/products/{product}/barcodes/generate', [ProductBarcodeController::class, 'generate']);
        Route::post('/products/{product}/barcodes/assign', [ProductBarcodeController::class, 'assign']);
        Route::get('/products/{product}/barcode.svg', [ProductBarcodeController::class, 'barcodeSvg']);
        Route::get('/products/{product}/qr.svg', [ProductBarcodeController::class, 'qrSvg']);

        Route::apiResource('product-categories', ProductCategoryController::class)
            ->except('show')
            ->parameters(['product-categories' => 'productCategory']);
        Route::apiResource('brands', BrandController::class)->except('show');
        Route::apiResource('units', UnitController::class)->except('show');
        Route::apiResource('suppliers', SupplierController::class);

        Route::post('/pos/scan', ScanController::class);

        // --- Inventory -----------------------------------------------------------
        Route::get('/inventory', [InventoryController::class, 'index']);
        Route::post('/products/{product}/stock/adjust', [InventoryController::class, 'adjust']);
        Route::get('/products/{product}/stock/movements', [InventoryController::class, 'movements']);
        Route::get('/product-batches', [ProductBatchController::class, 'index']);

        // --- Purchasing (Phase 2) --------------------------------------------------
        Route::apiResource('purchase-orders', PurchaseOrderController::class)
            ->only(['index', 'store', 'show'])
            ->parameters(['purchase-orders' => 'purchaseOrder']);
        Route::put('/purchase-orders/{purchaseOrder}/status', [PurchaseOrderController::class, 'updateStatus']);
        Route::post('/purchase-orders/{purchaseOrder}/convert', [PurchaseOrderController::class, 'convert']);

        Route::apiResource('purchases', PurchaseController::class)->only(['index', 'store', 'show']);
        Route::post('/purchases/{purchase}/receive', [PurchaseController::class, 'receive']);
        Route::post('/purchases/{purchase}/payments', [PurchaseController::class, 'recordPayment']);
        Route::post('/purchases/{purchase}/returns', [PurchaseReturnController::class, 'store']);

        // --- Stock Transfers (Phase 2) ----------------------------------------------
        Route::apiResource('stock-transfers', StockTransferController::class)
            ->only(['index', 'store', 'show'])
            ->parameters(['stock-transfers' => 'stockTransfer']);
        Route::post('/stock-transfers/{stockTransfer}/request', [StockTransferController::class, 'request']);
        Route::post('/stock-transfers/{stockTransfer}/approve', [StockTransferController::class, 'approve']);
        Route::post('/stock-transfers/{stockTransfer}/dispatch', [StockTransferController::class, 'dispatch']);
        Route::post('/stock-transfers/{stockTransfer}/receive', [StockTransferController::class, 'receive']);
        Route::post('/stock-transfers/{stockTransfer}/cancel', [StockTransferController::class, 'cancel']);

        // --- Stock-Taking (Phase 2) --------------------------------------------------
        Route::apiResource('stock-takes', StockTakeController::class)
            ->only(['index', 'store', 'show'])
            ->parameters(['stock-takes' => 'stockTake']);
        Route::put('/stock-takes/{stockTake}/counts', [StockTakeController::class, 'recordCounts']);
        Route::post('/stock-takes/{stockTake}/submit', [StockTakeController::class, 'submit']);
        Route::post('/stock-takes/{stockTake}/approve', [StockTakeController::class, 'approve']);

        // --- Shifts ----------------------------------------------------------------
        Route::get('/shifts/current', [ShiftController::class, 'current']);
        Route::post('/shifts/open', [ShiftController::class, 'open']);
        Route::post('/shifts/{cashierShift}/close', [ShiftController::class, 'close']);
        Route::get('/shifts', [ShiftController::class, 'index']);

        // --- Sales / POS checkout ---------------------------------------------
        Route::get('/payment-methods', [PaymentMethodController::class, 'index']);
        Route::post('/payment-methods', [PaymentMethodController::class, 'store']);
        Route::put('/payment-methods/{paymentMethod}', [PaymentMethodController::class, 'update']);

        Route::get('/sales/held', [SaleController::class, 'held']);
        Route::apiResource('sales', SaleController::class)->only(['index', 'store', 'show']);
        Route::post('/sales/{sale}/complete', [SaleController::class, 'completeHeld']);
        Route::post('/sales/{sale}/returns', [SaleReturnController::class, 'store']);

        Route::get('/sales/{sale}/receipt.pdf', [ReceiptController::class, 'pdf']);
        Route::post('/sales/{sale}/receipt/email', [ReceiptController::class, 'email']);
        Route::post('/sales/{sale}/fiscalize', [SaleController::class, 'fiscalize']);

        // --- Customers / Credit / Loyalty (Phase 3) -----------------------------
        Route::apiResource('customers', CustomerController::class)->except('destroy');
        Route::post('/customers/{customer}/payments', [CustomerController::class, 'recordPayment']);

        // --- Quotations (Phase 3) ---------------------------------------------------
        Route::apiResource('quotations', QuotationController::class)->only(['index', 'store', 'show', 'update']);
        Route::put('/quotations/{quotation}/status', [QuotationController::class, 'updateStatus']);
        Route::post('/quotations/{quotation}/convert', [QuotationController::class, 'convert']);
        Route::post('/quotations/{quotation}/duplicate', [QuotationController::class, 'duplicate']);
        Route::get('/quotations/{quotation}/pdf', [QuotationController::class, 'pdf']);

        // --- Expenses / Profit (Phase 4) --------------------------------------------
        Route::apiResource('expense-categories', ExpenseCategoryController::class)
            ->only(['index', 'store'])
            ->parameters(['expense-categories' => 'expenseCategory']);
        Route::apiResource('expenses', ExpenseController::class);
        Route::get('/reports/profit', ProfitReportController::class);

        // --- Reports & BI (Phase 5) ---------------------------------------------
        Route::get('/reports/dashboard-summary', [ReportController::class, 'dashboardSummary']);
        Route::get('/reports/sales-trend', [ReportController::class, 'salesTrend']);
        Route::get('/reports/top-products', [ReportController::class, 'topProducts']);
        Route::get('/reports/low-stock', [ReportController::class, 'lowStock']);
        Route::get('/reports/tax', [ReportController::class, 'taxReport']);

        // --- Audit trail ---------------------------------------------------------
        Route::get('/audit-logs', [AuditLogController::class, 'index']);

        // --- Notifications (Phase 6) -------------------------------------------------
        Route::get('/notifications', [NotificationController::class, 'index']);
        Route::post('/notifications/{notification}/read', [NotificationController::class, 'markRead']);
        Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead']);

        // --- SaaS Platform Admin (Phase 7) -------------------------------------
        Route::get('/platform/businesses', [PlatformController::class, 'businesses']);
        Route::get('/platform/businesses/{businessId}', [PlatformController::class, 'show']);
        Route::put('/platform/businesses/{business}/status', [PlatformController::class, 'updateBusinessStatus']);
        Route::post('/platform/businesses/{business}/extend-license', [PlatformController::class, 'extendLicense']);
        Route::post('/platform/businesses/{business}/impersonate', [PlatformController::class, 'impersonate']);
        Route::delete('/platform/businesses/{business}', [PlatformController::class, 'destroy']);
        Route::post('/platform/businesses/{businessId}/restore', [PlatformController::class, 'restore']);
        Route::get('/platform/stats', [PlatformController::class, 'stats']);
        Route::get('/platform/notifications', [PlatformNotificationController::class, 'index']);
        Route::post('/platform/notifications/{notification}/read', [PlatformNotificationController::class, 'markRead']);
        Route::post('/platform/notifications/read-all', [PlatformNotificationController::class, 'markAllRead']);
    });
});
