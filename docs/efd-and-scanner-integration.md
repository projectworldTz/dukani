# EFD and scanner integration

Dukani keeps fiscal integration opt-in. Existing businesses remain unchanged because `efd_enabled` defaults to `false`, and existing sales are marked `not_required`. Enabling EFD does not alter sale totals, stock movements, or historical receipts.

## EFD/VFD adapter contract

Dukani sends completed sales to the approved provider adapter configured in the backend environment:

```env
EFD_GATEWAY_URL=https://provider.example/api/fiscalize
EFD_GATEWAY_TOKEN=
EFD_GATEWAY_TIMEOUT=15
```

The adapter must return JSON containing:

```json
{
  "receipt_number": "provider receipt number",
  "verification_code": "TRA verification code",
  "verification_url": "https://verify.tra.go.tz/...",
  "z_number": "provider Z number"
}
```

Only values returned by the provider are printed as fiscal identifiers. If the provider is unavailable, the sale remains recorded and stock is not rolled back or duplicated. The receipt is clearly marked non-fiscal and an authorized cashier can retry from the completion dialog. A successful response is stored once, so later retries do not create another fiscal receipt.

Configure the business TIN, VRN, EFD serial, UIN, tax office, and thermal paper width in Settings before enabling EFD. Provider-specific field mapping should live in the adapter rather than in the checkout UI.

## Thermal printers

Receipts are rendered for 58 mm, 80 mm, or A4 paper. Use the operating-system driver for a USB, network, or Bluetooth thermal printer and select the matching paper size. Browser printing is intentionally retained because printer command protocols vary by manufacturer.

## Barcode and QR scanners

USB and Bluetooth scanners that operate as a keyboard are supported at checkout. Configure the scanner to append Enter after each scan. The product search accepts a barcode or Dukani product QR payload and immediately adds the matched product while respecting stock at the selected branch.

Camera scanning and direct manufacturer-specific USB/serial commands are separate integrations; they require the exact scanner/EFD model and vendor protocol.
