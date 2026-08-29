<?php

namespace App\Mail;

use App\Models\Sale;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class SaleReceiptMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public Sale $sale, public string $pdfContent) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: "Your receipt {$this->sale->receipt_number}");
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.sale-receipt',
            with: ['receiptNumber' => $this->sale->receipt_number],
        );
    }

    public function attachments(): array
    {
        return [
            Attachment::fromData(fn () => $this->pdfContent, "{$this->sale->receipt_number}.pdf")
                ->withMime('application/pdf'),
        ];
    }
}
