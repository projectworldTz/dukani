<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        @php
            $dims = ['small' => ['w' => '38mm', 'h' => '20mm'], 'medium' => ['w' => '50mm', 'h' => '30mm'], 'large' => ['w' => '70mm', 'h' => '40mm']][$size];
        @endphp
        body { font-family: 'DejaVu Sans', sans-serif; margin: 0; }
        .sheet { display: flex; flex-wrap: wrap; }
        .label {
            width: {{ $dims['w'] }};
            height: {{ $dims['h'] }};
            border: 1px dashed #ccc;
            padding: 2mm;
            margin: 1mm;
            box-sizing: border-box;
            text-align: center;
            overflow: hidden;
        }
        .business { font-size: 7px; color: #555; }
        .name { font-size: 9px; font-weight: bold; margin: 1px 0; }
        .price { font-size: 10px; font-weight: bold; }
        .sku { font-size: 7px; color: #555; }
        .codes { display: flex; align-items: center; justify-content: center; gap: 2mm; }
        svg { max-width: 90%; max-height: 12mm; }
    </style>
</head>
<body>
    <div class="sheet">
        @foreach($labels as $label)
        <div class="label">
            <div class="business">{{ $businessName }}</div>
            <div class="name">{{ $label['product']->name }}</div>
            <div class="price">{{ number_format($label['product']->selling_price, 2) }}</div>
            <div class="codes">
                @if($label['barcode_svg'])
                    {!! $label['barcode_svg'] !!}
                @endif
                @if($label['qr_svg'])
                    {!! $label['qr_svg'] !!}
                @endif
            </div>
            @if($label['product']->sku)
            <div class="sku">{{ $label['product']->sku }}</div>
            @endif
        </div>
        @endforeach
    </div>
</body>
</html>
