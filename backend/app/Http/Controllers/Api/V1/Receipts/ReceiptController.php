<?php

namespace App\Http\Controllers\Api\V1\Receipts;

use App\Http\Controllers\Controller;
use App\Mail\SaleReceiptMail;
use App\Models\Sale;
use App\Services\Audit\AuditLogger;
use App\Services\Products\QrCodeService;
use App\Support\Tenancy\BusinessContext;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rule;

class ReceiptController extends Controller
{
    public function __construct(private QrCodeService $qrCodeService, private AuditLogger $auditLogger) {}

    public function pdf(Request $request, Sale $sale)
    {
        $user = $request->user();
        $this->authorizeReceiptAccess($user, $sale);

        $request->validate(['paper' => ['nullable', Rule::in(['58mm', '80mm', 'a4'])]]);
        $paper = $request->string('paper', $user->business->settings?->receipt_paper_size ?? '80mm')->toString();

        $pdf = $this->buildPdf($sale, $user->business, $paper);

        $this->auditLogger->log('receipt.print', $sale, request: $request);

        return $pdf->stream("{$sale->receipt_number}.pdf");
    }

    /**
     * Emails the same PDF the print dialog shows to a customer-supplied address (falls
     * back to the sale's own customer_email if one wasn't captured at checkout) — the
     * only channel this app has for getting a receipt to a customer who didn't want a
     * paper copy, since there's no SMS/WhatsApp gateway configured.
     */
    public function email(Request $request, Sale $sale)
    {
        $user = $request->user();
        $this->authorizeReceiptAccess($user, $sale);

        $data = $request->validate([
            'email' => ['nullable', 'email'],
            'paper' => ['nullable', Rule::in(['58mm', '80mm', 'a4'])],
        ]);

        $recipient = $data['email'] ?? $sale->customer?->email;
        abort_unless($recipient, 422, 'No email address on file for this sale — provide one.');

        $pdf = $this->buildPdf($sale, $user->business, $data['paper'] ?? $user->business->settings?->receipt_paper_size ?? '80mm');

        Mail::to($recipient)->send(new SaleReceiptMail($sale, $pdf->output()));

        $this->auditLogger->log('receipt.email', $sale, newValues: ['email' => $recipient], request: $request);

        return response()->json(['message' => "Receipt emailed to {$recipient}."]);
    }

    private function authorizeReceiptAccess($user, Sale $sale): void
    {
        $canView = $user->can('sales.view.all')
            || $user->can('receipts.reprint')
            || ($user->can('sales.view.own') && $sale->cashier_id === $user->id);
        abort_unless($canView, 403);
        abort_unless($sale->status === 'completed', 422, 'Only completed sales have a receipt.');
    }

    private function buildPdf(Sale $sale, $business, string $paper)
    {
        $sale->loadMissing('items', 'payments.paymentMethod', 'cashier', 'branch');

        $isFiscal = $sale->fiscal_status === 'fiscalized' && $sale->fiscal_verification_url;
        $qrPayload = $isFiscal
            ? $sale->fiscal_verification_url
            : ($sale->receipt_verification_token ? $this->qrCodeService->receiptPayload($sale->receipt_verification_token) : null);
        $qrSvg = $qrPayload ? $this->qrCodeService->svg($qrPayload, 135) : null;

        $pdf = Pdf::loadView('receipts.receipt', [
            'sale' => $sale,
            'business' => $business,
            'settings' => $business->settings,
            'branch' => $sale->branch,
            'paper' => $paper,
            'qrSvg' => $qrSvg,
            'isFiscal' => $isFiscal,
        ]);

        if ($paper === '58mm') {
            $pdf->setPaper([0, 0, 164.4, 800], 'portrait');
        } elseif ($paper === '80mm') {
            $pdf->setPaper([0, 0, 226.8, 900], 'portrait');
        } else {
            $pdf->setPaper('a4', 'portrait');
        }

        return $pdf;
    }

    /**
     * Public, no auth — the QR code on a printed receipt links here. Returns only
     * receipt-safe fields, never the internal sale id (spec §7/§13).
     */
    public function verify(string $token)
    {
        // Unauthenticated request, no business context set — BusinessScope's
        // deny-by-default would otherwise hide every sale (and its items). The
        // verification token itself is the authorization here, not a business context.
        return BusinessContext::runAsPlatform(function () use ($token) {
            $sale = Sale::where('receipt_verification_token', $token)->where('status', 'completed')->first();

            abort_unless($sale, 404);

            $sale->load('items', 'branch', 'business');

            return [
                'business_name' => $sale->business->name,
                'branch_name' => $sale->branch->name,
                'receipt_number' => $sale->receipt_number,
                'date' => $sale->completed_at?->toDateTimeString(),
                'items' => $sale->items->map(fn ($item) => [
                    'name' => $item->product_name,
                    'quantity' => $item->quantity,
                    'line_total' => $item->line_total,
                ]),
                'grand_total' => $sale->grand_total,
                'currency' => $sale->currency,
                'payment_status' => 'paid',
            ];
        });
    }
}
