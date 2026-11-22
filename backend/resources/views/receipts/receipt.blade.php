<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        @page { margin: {{ $paper === 'a4' ? '18mm' : '2mm' }}; }
        body { font-family: 'DejaVu Sans Mono', monospace; width: {{ ['58mm'=>'54mm','80mm'=>'76mm','a4'=>'170mm'][$paper] }}; font-size: {{ $paper === 'a4' ? '11px' : '8.5px' }}; color:#000; margin:0; }
        .center{text-align:center}.right{text-align:right}.bold{font-weight:700}.small{font-size:.88em}.title{font-size:1.35em;font-weight:700;margin:2px 0}.status{border:1px solid #000;padding:3px;margin:5px 0;font-weight:700;text-align:center}
        hr{border:0;border-top:1px dashed #000;margin:4px 0} table{width:100%;border-collapse:collapse}td,th{padding:1px 0;vertical-align:top}th{text-align:left;border-bottom:1px solid #000}.qty{width:16%;white-space:nowrap}.amount{width:29%;text-align:right}.footer{margin-top:6px;text-align:center}
    </style>
</head>
<body>
    <div class="center bold small">*** START OF {{ $isFiscal ? 'LEGAL' : 'SALES' }} RECEIPT ***</div>
    <div class="center title">{{ strtoupper($business->name) }}</div>
    @if($settings?->address)<div class="center">{{ $settings->address }}</div>@endif
    @if($settings?->phone)<div class="center">MOBILE: {{ $settings->phone }}</div>@endif
    <div class="center">TIN: {{ $settings?->tin ?: 'NOT SET' }}</div>
    <div class="center">VRN: {{ $settings?->vrn ?: 'NOT REGISTERED' }}</div>
    @if($settings?->efd_serial)<div class="center">SERIAL NO: {{ $settings->efd_serial }}</div>@endif
    @if($settings?->efd_uin)<div class="center small">UIN: {{ $settings->efd_uin }}</div>@endif
    @if($settings?->tax_office)<div class="center">TAX OFFICE: {{ strtoupper($settings->tax_office) }}</div>@endif
    <div class="center">{{ strtoupper($branch->name) }}</div>
    @unless($isFiscal)<div class="status">NON-FISCAL RECEIPT</div>@endunless
    <hr>

    @if($sale->customer_name || $sale->customer)
        <div>CUSTOMER NAME: {{ strtoupper($sale->customer?->name ?? $sale->customer_name) }}</div>
        <div>CUSTOMER MOBILE: {{ $sale->customer?->phone ?? $sale->customer_phone ?? 'N/A' }}</div>
        <hr>
    @endif

    <table>
        <tr><td>RECEIPT NO:</td><td class="right">{{ $sale->fiscal_receipt_number ?: $sale->receipt_number }}</td></tr>
        @if($sale->fiscal_z_number)<tr><td>Z NUMBER:</td><td class="right">{{ $sale->fiscal_z_number }}</td></tr>@endif
        <tr><td>RECEIPT DATE:</td><td class="right">{{ $sale->completed_at?->copy()->timezone($business->timezone ?: config('app.timezone'))->format('d/m/Y') }}</td></tr>
        <tr><td>RECEIPT TIME:</td><td class="right">{{ $sale->completed_at?->copy()->timezone($business->timezone ?: config('app.timezone'))->format('H:i:s') }}</td></tr>
        <tr><td>CASHIER:</td><td class="right">{{ strtoupper($sale->cashier->name) }}</td></tr>
    </table>
    <hr>

    @if($sale->relationLoaded('prescription') && $sale->prescription)
        <div class="center bold">PRESCRIPTION</div>
        <table>
            <tr><td>RX NO:</td><td class="right">{{ $sale->prescription->rx_number }}</td></tr>
            <tr><td>PATIENT:</td><td class="right">{{ strtoupper($sale->prescription->patient_name) }}@if($sale->prescription->patient_age) ({{ $sale->prescription->patient_age }} YRS)@endif</td></tr>
            <tr><td>PRESCRIBER:</td><td class="right">{{ strtoupper($sale->prescription->prescriber_name) }}</td></tr>
            @if($sale->prescription->facility)<tr><td>FACILITY:</td><td class="right">{{ strtoupper($sale->prescription->facility) }}</td></tr>@endif
        </table>
        <hr>
    @endif
    <div class="center bold">PURCHASED ITEMS</div>
    <table>
        <thead><tr><th>DESCRIPTION</th><th class="qty">QTY</th><th class="amount">AMOUNT</th><th class="right">TYPE</th></tr></thead>
        <tbody>
        @foreach($sale->items as $item)
            @php($weighed = ($item->price_divisor ?? 1) > 1)
            @php($qtyLabel = $weighed ? rtrim(rtrim(number_format($item->quantity / $item->price_divisor, 3), '0'), '.').' KG' : $item->quantity)
            <tr><td>{{ strtoupper($item->product_name) }}</td><td>{{ $qtyLabel }}</td><td class="amount">{{ number_format($item->line_total, 2) }}</td><td class="right">{{ $item->tax_amount > 0 ? 'A' : 'C' }}</td></tr>
            <tr class="small"><td colspan="4">{{ $weighed ? strtolower($qtyLabel) : $item->quantity }} x {{ number_format($item->unit_price, 2) }}{{ $weighed ? '/KG' : '' }} @if($item->discount_amount > 0) DISC {{ number_format($item->discount_amount, 2) }} @endif</td></tr>
            @if($item->relationLoaded('batches') && $item->batches->whereNotNull('batch_number')->isNotEmpty())
                <tr class="small"><td colspan="4">@foreach($item->batches->whereNotNull('batch_number') as $b)BATCH {{ $b->batch_number }} EXP {{ $b->expiry_date?->format('m/Y') }}@if(! $loop->last); @endif @endforeach</td></tr>
            @endif
            @if($item->dosage_instructions)
                <tr><td colspan="4" class="bold">&gt;&gt; {{ $item->dosage_instructions }}</td></tr>
            @endif
        @endforeach
        </tbody>
    </table>
    <hr>

    <table>
        <tr><td>TOTAL EXCL OF TAX:</td><td class="right">{{ number_format($sale->grand_total - $sale->tax_total, 2) }}</td></tr>
        <tr><td>TOTAL TAX:</td><td class="right">{{ number_format($sale->tax_total, 2) }}</td></tr>
        <tr class="bold"><td>TOTAL INCL OF TAX:</td><td class="right">{{ number_format($sale->grand_total, 2) }}</td></tr>
        <tr><td>PAID:</td><td class="right">{{ number_format($sale->amount_paid, 2) }}</td></tr>
        <tr><td>CHANGE:</td><td class="right">{{ number_format($sale->change_amount, 2) }}</td></tr>
    </table>
    <hr>
    @foreach($sale->payments as $payment)
        <div>{{ strtoupper($payment->paymentMethod->name) }}: <span style="float:right">{{ number_format($payment->amount, 2) }}</span></div>
    @endforeach

    @if($qrSvg)
        <div class="center" style="margin-top:6px;">{!! $qrSvg !!}</div>
    @endif
    @if($sale->fiscal_verification_code)
        <div class="center bold">RECEIPT VERIFICATION CODE</div>
        <div class="center title">{{ $sale->fiscal_verification_code }}</div>
    @else
        <div class="center small">Scan to verify this sale in Dukani</div>
    @endif

    @if($business->isPharmacy() && $sale->items->whereNotNull('dosage_instructions')->isNotEmpty())
        <div class="center small" style="margin-top:4px;">Take medicines exactly as directed. Keep out of reach of children.</div>
    @endif
    <div class="footer">{{ $settings?->receipt_footer_text ?: 'Thank you for shopping with us.' }}</div>
    <div class="center bold small">*** END OF {{ $isFiscal ? 'LEGAL' : 'SALES' }} RECEIPT ***</div>
</body>
</html>
