<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class VerifyEmailMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public User $user, public string $token) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Verify your Dukani email address');
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.verify-email',
            with: [
                'name' => $this->user->name,
                'verifyUrl' => rtrim(config('app.frontend_url'), '/')
                    .'/verify-email?token='.$this->token
                    .'&email='.urlencode($this->user->email),
            ],
        );
    }
}
