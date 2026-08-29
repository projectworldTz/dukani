<?php

namespace App\Mail;

use App\Models\Business;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class LicenseExpiringMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public Business $business) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Your Dukani license renewal is due soon');
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.license-expiring',
            with: [
                'businessName' => $this->business->name,
                'expiresAt' => $this->business->license_expires_at,
            ],
        );
    }
}
