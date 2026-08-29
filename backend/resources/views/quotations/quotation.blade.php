<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        @page { margin: 18mm 16mm; }
        body { font-family: 'DejaVu Sans', sans-serif; font-size: 11px; color: #1f2937; }
        .header { width: 100%; margin-bottom: 6mm; }
        .header td { vertical-align: top; }
        .logo { max-height: 60px; max-width: 160px; }
        .business-name { font-size: 18px; font-weight: bold; color: #111827; }
        .muted { color: #6b7280; }
        .title-block { text-align: right; }
        .doc-title { font-size: 22px; font-weight: bold; letter-spacing: 1px; color: #111827; }
        .doc-number { font-size: 12px; color: #374151; margin-top: 2px; }
        hr { border: none; border-top: 1px solid #e5e7eb; margin: 4mm 0; }
        .meta-table { width: 100%; margin-bottom: 5mm; }
        .meta-table td { vertical-align: top; padding: 0; }
        .meta-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; margin-bottom: 1mm; }
        .meta-value { font-size: 11px; font-weight: bold; color: #111827; }
        table.items { width: 100%; border-collapse: collapse; margin-bottom: 5mm; }
        table.items th { background: #111827; color: #fff; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.3px; padding: 3mm 2mm; text-align: left; }
        table.items th.right, table.items td.right { text-align: right; }
        table.items td { padding: 2.5mm 2mm; border-bottom: 1px solid #e5e7eb; font-size: 10.5px; }
        table.items tr:nth-child(even) td { background: #f9fafb; }
        .totals-table { width: 60mm; margin-left: auto; margin-bottom: 5mm; }
        .totals-table td { padding: 1.2mm 0; font-size: 11px; }
        .totals-table .grand td { font-size: 13px; font-weight: bold; border-top: 1.5px solid #111827; padding-top: 2mm; }
        .box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 3px; padding: 3mm 4mm; margin-bottom: 4mm; }
        .box-title { font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; margin-bottom: 1.5mm; font-weight: bold; }
        .footer-note { margin-top: 6mm; padding-top: 4mm; border-top: 1px solid #e5e7eb; font-size: 9.5px; color: #6b7280; text-align: center; line-height: 1.5; }
        .status-chip { display: inline-block; padding: 1mm 3mm; border-radius: 3px; font-size: 9px; text-transform: uppercase; font-weight: bold; color: #fff; background: #6b7280; }
    </style>
</head>
<body>
    <table class="header">
        <tr>
            <td style="width: 55%;">
                @if($settings?->logo_path)
                    @php
                        $logoAbsolutePath = storage_path('app/public/'.$settings->logo_path);
                        $logoData = is_file($logoAbsolutePath) ? base64_encode(file_get_contents($logoAbsolutePath)) : null;
                    @endphp
                    @if($logoData)
                        <img class="logo" src="data:image/png;base64,{{ $logoData }}" alt="Logo"><br>
                    @endif
                @endif
                <div class="business-name">{{ $business->name }}</div>
                @if($settings?->address)<div class="muted">{{ $settings->address }}</div>@endif
                <div class="muted">
                    @if($settings?->phone) {{ $settings->phone }} @endif
                    @if($settings?->phone && $settings?->email) &middot; @endif
                    @if($settings?->email) {{ $settings->email }} @endif
                </div>
                @if($settings?->tin)<div class="muted">TIN: {{ $settings->tin }}</div>@endif
            </td>
            <td class="title-block" style="width: 45%;">
                <div class="doc-title">QUOTATION</div>
                <div class="doc-number">{{ $quotation->quotation_number }}</div>
                <div style="margin-top: 3mm;"><span class="status-chip">{{ str_replace('_', ' ', $quotation->status) }}</span></div>
            </td>
        </tr>
    </table>

    <table class="meta-table">
        <tr>
            <td style="width: 40%;">
                <div class="meta-label">Prepared for</div>
                <div class="meta-value">{{ $quotation->customer?->name ?? $quotation->customer_name ?? 'Walk-in customer' }}</div>
                @if($quotation->customer?->phone)<div class="muted">{{ $quotation->customer->phone }}</div>@endif
                @if($quotation->customer?->email)<div class="muted">{{ $quotation->customer->email }}</div>@endif
            </td>
            <td style="width: 30%;">
                <div class="meta-label">Date issued</div>
                <div class="meta-value">{{ $quotation->created_at->format('d M Y') }}</div>
            </td>
            <td style="width: 30%;">
                <div class="meta-label">Valid until</div>
                <div class="meta-value">{{ $quotation->valid_until?->format('d M Y') ?? 'On request' }}</div>
            </td>
        </tr>
    </table>

    <table class="items">
        <thead>
            <tr>
                <th style="width: 5%;">#</th>
                <th style="width: 35%;">Description</th>
                <th class="right" style="width: 10%;">Qty</th>
                <th class="right" style="width: 15%;">Unit Price</th>
                <th class="right" style="width: 12%;">Discount</th>
                <th class="right" style="width: 10%;">Tax</th>
                <th class="right" style="width: 13%;">Line Total</th>
            </tr>
        </thead>
        <tbody>
            @foreach($quotation->items as $index => $item)
            <tr>
                <td>{{ $index + 1 }}</td>
                <td>{{ $item->product_name }}</td>
                <td class="right">{{ $item->quantity }}</td>
                <td class="right">{{ number_format($item->unit_price, 2) }}</td>
                <td class="right">{{ $item->discount_amount > 0 ? number_format($item->discount_amount, 2) : '—' }}</td>
                <td class="right">{{ $item->tax_amount > 0 ? number_format($item->tax_amount, 2) : '—' }}</td>
                <td class="right">{{ number_format($item->line_total, 2) }}</td>
            </tr>
            @endforeach
        </tbody>
    </table>

    <table class="totals-table">
        <tr><td>Subtotal</td><td class="right">{{ $business->currency }} {{ number_format($quotation->subtotal, 2) }}</td></tr>
        @if($quotation->discount_total > 0)
        <tr><td>Discount</td><td class="right">-{{ $business->currency }} {{ number_format($quotation->discount_total, 2) }}</td></tr>
        @endif
        @if($quotation->tax_total > 0)
        <tr><td>Tax (VAT)</td><td class="right">{{ $business->currency }} {{ number_format($quotation->tax_total, 2) }}</td></tr>
        @endif
        <tr class="grand"><td>Grand Total</td><td class="right">{{ $business->currency }} {{ number_format($quotation->grand_total, 2) }}</td></tr>
    </table>

    @if($quotation->payment_terms)
    <div class="box">
        <div class="box-title">Payment Terms</div>
        {{ $quotation->payment_terms }}
    </div>
    @endif

    @if($quotation->notes)
    <div class="box">
        <div class="box-title">Notes</div>
        {{ $quotation->notes }}
    </div>
    @endif

    <div class="footer-note">
        @if($quotation->valid_until)
            This quotation is valid until <strong>{{ $quotation->valid_until->format('d M Y') }}</strong>
            ({{ max(0, (int) $quotation->created_at->startOfDay()->diffInDays($quotation->valid_until, false)) }} days from issue).
            Prices are subject to change after the validity period.
        @else
            Prices are subject to change without notice — please contact us to confirm current pricing before purchasing.
        @endif
        <br>
        @if($settings?->phone || $settings?->email)
            For questions about this quotation, contact us
            @if($settings?->phone) on {{ $settings->phone }} @endif
            @if($settings?->phone && $settings?->email) or @endif
            @if($settings?->email) at {{ $settings->email }} @endif.
        @endif
    </div>
</body>
</html>
