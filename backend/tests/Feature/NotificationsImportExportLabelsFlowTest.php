<?php

namespace Tests\Feature;

use App\Models\Branch;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

/** Exercises Phase 6: low-stock notifications, product CSV import/export, and label PDFs. */
class NotificationsImportExportLabelsFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_stock_crossing_reorder_level_creates_one_low_stock_notification(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'business_name' => 'Mama Nia Shop', 'owner_name' => 'Nia Mwangi', 'email' => 'nia@example.com',
            'password' => 'password123', 'password_confirmation' => 'password123',
        ])->assertCreated();
        $token = $response->json('token');
        $api = fn () => $this->withToken($token);
        $branch = Branch::firstOrFail();

        $product = $api()->postJson('/api/v1/products', [
            'name' => 'Cooking Oil 5L', 'cost_price' => 15000, 'selling_price' => 20000, 'reorder_level' => 5,
        ])->assertCreated()->json();

        // 10 -> stays above reorder level, no notification yet.
        $api()->postJson("/api/v1/products/{$product['id']}/stock/adjust", [
            'branch_id' => $branch->id, 'quantity_change' => 10, 'type' => 'opening_stock',
        ])->assertCreated();
        $this->assertCount(0, $api()->getJson('/api/v1/notifications')->json());

        // Drop to 3 -> crosses at-or-below reorder level of 5, notifies once.
        $api()->postJson("/api/v1/products/{$product['id']}/stock/adjust", [
            'branch_id' => $branch->id, 'quantity_change' => -7, 'type' => 'adjustment', 'reason' => 'test',
        ])->assertCreated();
        $notifications = $api()->getJson('/api/v1/notifications')->json();
        $this->assertCount(1, $notifications);
        $this->assertSame('low_stock', $notifications[0]['type']);

        // Drop further while still below reorder level -> no duplicate notification.
        $api()->postJson("/api/v1/products/{$product['id']}/stock/adjust", [
            'branch_id' => $branch->id, 'quantity_change' => -1, 'type' => 'adjustment', 'reason' => 'test',
        ])->assertCreated();
        $this->assertCount(1, $api()->getJson('/api/v1/notifications')->json());

        $api()->postJson("/api/v1/notifications/{$notifications[0]['id']}/read")->assertOk();
        $this->assertCount(0, $api()->getJson('/api/v1/notifications?unread_only=1')->json());
    }

    public function test_product_csv_import_and_export_round_trip(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'business_name' => 'Mama Nia Shop', 'owner_name' => 'Nia Mwangi', 'email' => 'nia@example.com',
            'password' => 'password123', 'password_confirmation' => 'password123',
        ])->assertCreated();
        $token = $response->json('token');
        $api = fn () => $this->withToken($token);

        $header = ['name', 'sku', 'category', 'brand', 'unit', 'cost_price', 'selling_price', 'tax_rate', 'reorder_level', 'status'];
        $goodRow = ['Sugar 1kg', 'SUG-1', '', '', '', '2000', '2500', '0', '5', 'active'];
        $badRow = ['Bad Row', '', '', '', '', '', '', '', '', '']; // missing required numeric prices -> rejected
        $csv = implode(',', $header)."\n".implode(',', $goodRow)."\n".implode(',', $badRow)."\n";

        $file = UploadedFile::fake()->createWithContent('products.csv', $csv);

        $result = $api()->post('/api/v1/products/import', ['file' => $file])->assertOk()->json();
        $this->assertSame(1, $result['created']);
        $this->assertCount(1, $result['errors']);

        $export = $api()->get('/api/v1/products/export')->assertOk();
        $this->assertStringContainsString('Sugar 1kg', $export->streamedContent());

        $api()->postJson('/api/v1/products', [
            'name' => '=HYPERLINK("https://example.invalid")',
            'cost_price' => 1,
            'selling_price' => 2,
        ])->assertCreated();
        $safeExport = $api()->get('/api/v1/products/export')->assertOk()->streamedContent();
        $this->assertStringContainsString("'=HYPERLINK", $safeExport);
    }

    public function test_label_sheet_pdf_renders_for_selected_products(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'business_name' => 'Mama Nia Shop', 'owner_name' => 'Nia Mwangi', 'email' => 'nia@example.com',
            'password' => 'password123', 'password_confirmation' => 'password123',
        ])->assertCreated();
        $token = $response->json('token');
        $api = fn () => $this->withToken($token);

        $product = $api()->postJson('/api/v1/products', [
            'name' => 'Cooking Oil 5L', 'cost_price' => 15000, 'selling_price' => 20000, 'generate_barcode' => true,
        ])->assertCreated()->json();

        $api()->postJson('/api/v1/products/labels', [
            'product_ids' => [$product['id']], 'copies' => 3, 'size' => 'medium', 'include_qr' => true,
        ])->assertOk()->assertHeader('content-type', 'application/pdf');
    }
}
