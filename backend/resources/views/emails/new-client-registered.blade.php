<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
</head>
<body style="margin:0; padding:32px 16px; background:#EFF6FF; font-family: 'Segoe UI', Arial, sans-serif; color:#0F172A;">
    <table role="presentation" width="100%" style="max-width:520px; margin:0 auto; background:#FFFFFF; border-radius:16px; overflow:hidden; box-shadow:0 10px 30px rgba(30,64,175,0.15);">
        <tr>
            <td style="background:linear-gradient(135deg,#1E40AF,#2563EB); padding:24px 32px;">
                <span style="font-size:20px; font-weight:800; color:#EFF6FF;">Dukani</span>
                <span style="float:right; font-size:12px; font-weight:700; color:#BFDBFE; padding-top:6px;">NEW CLIENT</span>
            </td>
        </tr>
        <tr>
            <td style="padding:28px 32px;">
                <h2 style="margin:0 0 6px; font-size:20px;">{{ $business->name }} just registered</h2>
                <p style="margin:0 0 20px; font-size:14px; color:#475569;">
                    Contact them to negotiate a subscription before their free trial ends.
                </p>

                <table role="presentation" width="100%" style="font-size:14px; border-collapse:collapse;">
                    @foreach ([
                        'Business' => $business->name,
                        'Category' => $business->category ?: '—',
                        'Owner' => $owner->name,
                        'Phone' => $owner->phone ?: 'Not given',
                        'Email' => $owner->email,
                        'Registered' => $business->created_at?->timezone($business->timezone ?: 'Africa/Dar_es_Salaam')->format('d M Y, H:i'),
                        'Trial ends' => $trialEnds?->timezone($business->timezone ?: 'Africa/Dar_es_Salaam')->format('d M Y'),
                    ] as $label => $value)
                        <tr>
                            <td style="padding:8px 0; color:#64748B; width:120px; border-bottom:1px solid #E2E8F0;">{{ $label }}</td>
                            <td style="padding:8px 0; font-weight:600; border-bottom:1px solid #E2E8F0;">{{ $value }}</td>
                        </tr>
                    @endforeach
                </table>

                <div style="margin-top:24px;">
                    @if ($callLink)
                        <a href="{{ $callLink }}" style="display:inline-block; background:#2563EB; color:#FFFFFF; text-decoration:none; font-weight:700; font-size:14px; padding:11px 20px; border-radius:10px; margin:0 8px 8px 0;">Call {{ $owner->phone }}</a>
                    @endif
                    @if ($whatsappLink)
                        <a href="{{ $whatsappLink }}" style="display:inline-block; background:#16A34A; color:#FFFFFF; text-decoration:none; font-weight:700; font-size:14px; padding:11px 20px; border-radius:10px; margin:0 8px 8px 0;">WhatsApp</a>
                    @endif
                    <a href="mailto:{{ $owner->email }}" style="display:inline-block; background:#F1F5F9; color:#0F172A; text-decoration:none; font-weight:700; font-size:14px; padding:11px 20px; border-radius:10px; margin:0 8px 8px 0;">Email</a>
                </div>

                <p style="margin:20px 0 0; font-size:12px; color:#94A3B8;">
                    When they pay, open the <a href="{{ $adminUrl }}" style="color:#2563EB;">Platform Admin</a> page and extend their license — access is restored straight away.
                </p>
            </td>
        </tr>
    </table>
</body>
</html>
