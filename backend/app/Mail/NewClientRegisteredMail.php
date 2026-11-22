<?php

namespace App\Mail;

use App\Models\Business;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/** To the platform owner: a new business just signed up — contact them. */
class NewClientRegisteredMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public Business $business, public User $owner) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: "New Dukani client: {$this->business->name} — contact them to negotiate");
    }

    public function content(): Content
    {
        $phone = $this->owner->phone;
        $digits = $phone ? \App\Services\Notifications\SmsSender::normalise($phone) : null;

        return new Content(
            view: 'emails.new-client-registered',
            with: [
                'business' => $this->business,
                'owner' => $this->owner,
                'trialEnds' => $this->business->license_expires_at,
                'callLink' => $phone ? 'tel:'.preg_replace('/[^\d+]/', '', $phone) : null,
                'whatsappLink' => $digits ? "https://wa.me/{$digits}" : null,
                'adminUrl' => rtrim((string) config('app.frontend_url', config('app.url')), '/').'/platform',
            ],
        );
    }
}
