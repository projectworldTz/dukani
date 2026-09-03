<?php

namespace App\Services\Fiscal;

use App\Models\Sale;
use Illuminate\Support\Facades\Http;
use Throwable;

class FiscalizationService
{
    public function fiscalize(Sale $sale): Sale
    {
        $sale->loadMissing('business.settings', 'branch', 'cashier', 'customer', 'items', 'payments.paymentMethod');
        $settings = $sale->business->settings;

        if (! $settings?->efd_enabled || $sale->status !== 'completed') {
            return $sale;
        }

        if ($sale->fiscal_status === 'fiscalized') {
            return $sale;
        }

        $url = config('dukani.efd.gateway_url');
        if (! $url) {
            return $this->fail($sale, 'EFD is enabled but EFD_GATEWAY_URL is not configured.');
        }

        $sale->update(['fiscal_status' => 'pending', 'fiscal_error' => null]);

        try {
            $request = Http::acceptJson()->asJson()->timeout(config('dukani.efd.timeout', 15));
            if ($token = config('dukani.efd.gateway_token')) {
                $request = $request->withToken($token);
            }

            $response = $request->post($url, $this->payload($sale))->throw()->json();
            foreach (['receipt_number', 'verification_code', 'verification_url', 'z_number'] as $field) {
                if (blank($response[$field] ?? null)) {
                    throw new \RuntimeException("EFD gateway response is missing {$field}.");
                }
            }

            $sale->update([
                'fiscal_status' => 'fiscalized',
                'fiscal_receipt_number' => $response['receipt_number'],
                'fiscal_verification_code' => $response['verification_code'],
                'fiscal_verification_url' => $response['verification_url'],
                'fiscal_z_number' => $response['z_number'],
                'fiscalized_at' => now(),
                'fiscal_error' => null,
            ]);
        } catch (Throwable $exception) {
            report($exception);

            return $this->fail($sale, $exception->getMessage());
        }

        return $sale->fresh();
    }

    private function payload(Sale $sale): array
    {
        return [
            'transaction_id' => (string) $sale->id,
            'issued_at' => $sale->completed_at?->toIso8601String(),
            'seller' => [
                'name' => $sale->business->name,
                'tin' => $sale->business->settings?->tin,
                'vrn' => $sale->business->settings?->vrn,
                'efd_serial' => $sale->business->settings?->efd_serial,
                'uin' => $sale->business->settings?->efd_uin,
                'tax_office' => $sale->business->settings?->tax_office,
                'branch' => $sale->branch?->name,
            ],
            'customer' => [
                'name' => $sale->customer?->name ?? $sale->customer_name,
                'tin' => $sale->customer?->tin,
                'mobile' => $sale->customer?->phone ?? $sale->customer_phone,
            ],
            'items' => $sale->items->map(fn ($item) => [
                'description' => $item->product_name,
                'quantity' => (int) $item->quantity,
                'unit_price' => (float) $item->unit_price,
                'discount' => (float) $item->discount_amount,
                'tax' => (float) $item->tax_amount,
                'total' => (float) $item->line_total,
                'tax_code' => (float) $item->tax_amount > 0 ? 'A' : 'C',
            ])->values()->all(),
            'totals' => [
                'exclusive' => round((float) $sale->grand_total - (float) $sale->tax_total, 2),
                'tax' => (float) $sale->tax_total,
                'inclusive' => (float) $sale->grand_total,
                'currency' => $sale->currency,
            ],
            'payments' => $sale->payments->map(fn ($payment) => [
                'method' => $payment->paymentMethod?->type,
                'amount' => (float) $payment->amount,
                'reference' => $payment->reference,
            ])->values()->all(),
        ];
    }

    private function fail(Sale $sale, string $message): Sale
    {
        $sale->update(['fiscal_status' => 'failed', 'fiscal_error' => mb_substr($message, 0, 2000)]);

        return $sale->fresh();
    }
}
