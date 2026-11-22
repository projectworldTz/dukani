<?php

namespace App\Services\Notifications;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * Sends a plain SMS through the gateway configured in config/dukani.php (sms.driver):
 *
 *  - log            nothing is sent; the message is written to the Laravel log
 *  - beem           Beem Africa (apisms.beem.africa)
 *  - nextsms        NextSMS Tanzania (messaging-service.co.tz)
 *  - africastalking Africa's Talking
 *
 * Phone numbers may be typed any common way ("0712 345 678", "+255712345678");
 * they are normalised to 255712345678 before sending.
 */
class SmsSender
{
    public function send(string $phone, string $message): void
    {
        $to = self::normalise($phone);
        if ($to === null) {
            throw new RuntimeException("Invalid phone number for SMS: {$phone}");
        }

        $config = config('dukani.sms');
        $driver = $config['driver'] ?? 'log';
        $http = Http::timeout($config['timeout'] ?? 15)->acceptJson();

        match ($driver) {
            'beem' => $http
                ->withBasicAuth((string) $config['beem']['api_key'], (string) $config['beem']['secret_key'])
                ->post('https://apisms.beem.africa/v1/send', [
                    'source_addr' => $config['sender_id'],
                    'encoding' => 0,
                    'message' => $message,
                    'recipients' => [['recipient_id' => 1, 'dest_addr' => $to]],
                ])->throw(),
            'nextsms' => $http
                ->withBasicAuth((string) $config['nextsms']['username'], (string) $config['nextsms']['password'])
                ->post($config['nextsms']['url'], ['from' => $config['sender_id'], 'to' => $to, 'text' => $message])
                ->throw(),
            'africastalking' => $http
                ->withHeaders(['apiKey' => (string) $config['africastalking']['api_key']])
                ->asForm()
                ->post('https://api.africastalking.com/version1/messaging', array_filter([
                    'username' => $config['africastalking']['username'],
                    'to' => '+'.$to,
                    'message' => $message,
                    'from' => $config['sender_id'] !== 'INFO' ? $config['sender_id'] : null,
                ]))->throw(),
            default => Log::info("[SMS:log] to {$to}: {$message}"),
        };
    }

    /** "0712 345 678" / "+255 712 345 678" / "712345678" → "255712345678" (Tanzania default). */
    public static function normalise(string $phone): ?string
    {
        $digits = preg_replace('/\D+/', '', $phone);
        if ($digits === '' || $digits === null) {
            return null;
        }
        if (str_starts_with($digits, '00')) {
            $digits = substr($digits, 2);
        }
        if (str_starts_with($digits, '0')) {
            $digits = '255'.substr($digits, 1);
        } elseif (strlen($digits) === 9) {
            $digits = '255'.$digits;
        }

        return strlen($digits) >= 10 && strlen($digits) <= 15 ? $digits : null;
    }
}
