<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        @page { margin: {{ $paper === 'a4' ? '20mm' : '2mm' }}; }
        body {
            font-family: 'DejaVu Sans', sans-serif;
            width: {{ ['58mm' => '54mm', '80mm' => '76mm', 'a4' => '170mm'][$paper] }};
            font-size: {{ $paper === 'a4' ? '12px' : '10px' }};
            color: #000;
        }
        .center { text-align: center; }
        .right { text-align: right; }
        .bold { font-weight: bold; }
        hr { border: none; border-top: 1px dashed #000; margin: 4px 0; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 1px 0; vertical-align: top; }
        .items td { font-size: {{ $paper === 'a4' ? '11px' : '9px' }}; }
        .totals td { padding-top: 2px; }
        .footer { margin-top: 8px; text-align: center; font-size: {{ $paper === 'a4' ? '10px' : '8px' }}; }
    </style>
</head>
<body>
    <div class="center bold">{{ $business->name }}</div>
    @if($settings?->address)<div class="center">{{ $settings->address }}</div>@endif
    @if($settings?->phone)<div class="center">{{ $settings->phone }}</div>@endif
    @if($settings?->tin)<div class="center">TIN: {{ $settings->tin }}</div>@endif
    <div class="center">{{ $branch->name }}</div>
    <hr>

    <table>
        <tr><td>Receipt #</td><td class="right">{{ $sale->receipt_number }}</td></tr>
        <tr><td>Date</td><td class="right">{{ $sale->completed_at?->format('Y-m-d H:i') }}</td></tr>
        <tr><td>Cashier</td><td class="right">{{ $sale->cashier->name }}</td></tr>
        @if($sale->customer_name)<tr><td>Customer</td><td class="right">{{ $sale->customer_name }}</td></tr>@endif
    </table>
    <hr>

    <table class="items">
        @foreach($sale->items as $item)
        <tr>
            <td colspan="2">{{ $item->product_name }}</td>
        </tr>
        <tr>
            <td>{{ $item->quantity }} x {{ number_format($item->unit_price, 2) }}</td>
            <td class="right">{{ number_format($item->line_total, 2) }}</td>
        </tr>
        @endforeach
    </table>
    <hr>

    <table class="totals">
        <tr><td>Subtotal</td><td class="right">{{ number_format($sale->subtotal, 2) }}</td></tr>
        @if($sale->discount_total > 0)<tr><td>Discount</td><td class="right">-{{ number_format($sale->discount_total, 2) }}</td></tr>@endif
        <tr><td>Tax</td><td class="right">{{ number_format($sale->tax_total, 2) }}</td></tr>
        <tr class="bold"><td>Total ({{ $sale->currency }})</td><td class="right">{{ number_format($sale->grand_total, 2) }}</td></tr>
        <tr><td>Paid</td><td class="right">{{ number_format($sale->amount_paid, 2) }}</td></tr>
        <tr><td>Change</td><td class="right">{{ number_format($sale->change_amount, 2) }}</td></tr>
    </table>
    <hr>

    <table>
        @foreach($sale->payments as $payment)
        <tr><td>{{ $payment->paymentMethod->name }}</td><td class="right">{{ number_format($payment->amount, 2) }}</td></tr>
        @endforeach
    </table>

    @if($qrSvg)
    <div class="center" style="margin-top:6px;">{!! $qrSvg !!}</div>
    @endif

    <div class="footer">
        {{ $settings?->receipt_footer_text ?? 'Thank you for shopping with us.' }}
    </div>
</body>
</html>
