<?php

/**
 * Global permission catalog: module => permission name => description. Expanded as
 * later phases add modules (Purchases, Customers, Reports, etc.) — Phase 1 only
 * defines what the foundation + POS-checkout slice actually needs.
 *
 * Seeded per-business by App\Services\Rbac\RolePermissionSeederService whenever a
 * business is created — each business gets its own team-scoped copy (Spatie "teams"
 * feature, team column = business_id) which the Business Owner can then freely
 * customize per role without affecting any other business.
 */
return [

    'staff' => [
        'staff.manage' => 'Create, edit, activate/deactivate staff and assign roles',
    ],

    'roles' => [
        'roles.manage' => 'Create custom roles and edit role permissions',
    ],

    'branches' => [
        'branches.manage' => 'Create and edit branches',
        'branches.view.all' => 'View data across all branches, not just an assigned one',
    ],

    'business' => [
        'business.settings.manage' => 'Edit business profile, currency, tax, receipt settings',
    ],

    'products' => [
        'products.manage' => 'Create and edit products, categories, brands, units, barcodes/QR',
        'products.delete' => 'Delete (archive) a product',
    ],

    'inventory' => [
        'inventory.view' => 'View stock levels and stock movement history',
        'inventory.adjust' => 'Record opening stock and manual stock adjustments',
    ],

    'sales' => [
        'sales.create' => 'Ring up a sale at POS checkout',
        'sales.view.own' => "View one's own sales history and receipts",
        'sales.view.all' => 'View every sale in the business/branch',
        'sales.discount.apply' => 'Apply a discount at checkout (see role_limits for a cap)',
        'sales.credit.apply' => "Sell on customer credit (see the customer's own credit limit for a cap)",
        'sales.return' => 'Process a sales return/refund against a completed sale',
    ],

    'customers' => [
        'customers.view' => 'View customer details, balances, sales and loyalty history',
        'customers.manage' => 'Create and edit customers, record customer payments, adjust loyalty points',
    ],

    'quotations' => [
        'quotations.manage' => 'Create, send, and convert quotations to a sale',
    ],

    'receipts' => [
        'receipts.reprint' => 'Reprint a previously issued receipt',
    ],

    'shifts' => [
        'shifts.open' => 'Open a cashier shift',
        'shifts.close' => "Close one's own cashier shift",
        'shifts.view.all' => "View every cashier's shifts, not just one's own",
    ],

    'suppliers' => [
        'suppliers.manage' => 'Create and edit suppliers',
    ],

    'purchases' => [
        'purchases.manage' => 'Create purchase orders and purchases, record supplier payments, purchase returns',
        'purchases.receive' => 'Receive stock against a purchase (full or partial delivery)',
    ],

    'stock_transfers' => [
        'stock_transfers.manage' => 'Create, dispatch, and receive stock transfers between branches',
        'stock_transfers.approve' => 'Approve a requested stock transfer',
    ],

    'stock_takes' => [
        'stock_takes.manage' => 'Create stock takes and record physical counts',
        'stock_takes.approve' => 'Approve a submitted stock take, posting variances to inventory',
    ],

    'expenses' => [
        'expenses.manage' => 'Record and edit business expenses',
        'expenses.view' => 'View expenses without being able to add or edit them',
    ],

];
