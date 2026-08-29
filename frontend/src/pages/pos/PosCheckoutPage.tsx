import { Add, Delete, PauseCircle, QrCodeScanner, Remove } from '@mui/icons-material'
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  Chip,
  Grid,
  IconButton,
  List,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { paymentMethodsApi, salesApi } from '../../api/endpoints/sales'
import { customersApi } from '../../api/endpoints/customers'
import { productsApi } from '../../api/endpoints/products'
import type { CartLine, Product, Sale } from '../../types'
import { useAuthStore } from '../../stores/authStore'
import { OpenShiftGate } from './OpenShiftGate'
import { PaymentDialog, type PaymentLine } from './PaymentDialog'
import { ReceiptDialog } from './ReceiptDialog'

function money(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function CheckoutScreen({ branchId, shiftId }: { branchId: number; shiftId: number }) {
  const queryClient = useQueryClient()
  const currency = useAuthStore((s) => s.user?.business?.currency ?? '')
  const canDiscount = useAuthStore((s) => s.hasPermission('sales.discount.apply'))

  const [query, setQuery] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [customerId, setCustomerId] = useState<number | ''>('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [redeemPoints, setRedeemPoints] = useState(0)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [completedSale, setCompletedSale] = useState<Sale | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  // Set while resuming a previously-held sale — paying then completes THAT sale
  // (POST /sales/{id}/complete) instead of creating a brand new one.
  const [resumingSaleId, setResumingSaleId] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const searchQuery = useQuery({
    queryKey: ['products', 'search', query],
    queryFn: () => productsApi.list({ search: query || undefined, status: 'active' }),
  })

  const paymentMethodsQuery = useQuery({ queryKey: ['payment-methods'], queryFn: paymentMethodsApi.list })
  const heldQuery = useQuery({ queryKey: ['sales', 'held', branchId], queryFn: () => salesApi.held(branchId) })
  const customersQuery = useQuery({ queryKey: ['customers'], queryFn: () => customersApi.list() })
  const selectedCustomer = customersQuery.data?.find((c) => c.id === customerId)

  const scanMutation = useMutation({
    mutationFn: (code: string) => productsApi.scan(code),
    onSuccess: (product) => {
      addToCart(product)
      setQuery('')
      setScanError(null)
    },
    onError: () => setScanError('Product not found for that code.'),
    meta: { suppressErrorToast: true },
  })

  const saleMutation = useMutation({
    mutationFn: (payments: PaymentLine[]) =>
      resumingSaleId
        ? salesApi.complete(resumingSaleId, payments, redeemPoints || undefined)
        : salesApi.create({
            branch_id: branchId,
            shift_id: shiftId,
            customer_id: customerId || undefined,
            customer_name: customerName || undefined,
            customer_phone: customerPhone || undefined,
            redeem_points: redeemPoints || undefined,
            items: cart.map((line) => ({
              product_id: line.product.id,
              quantity: line.quantity,
              discount_amount: line.discountAmount || undefined,
            })),
            payments,
          }),
    onSuccess: (sale) => {
      setCompletedSale(sale)
      setCart([])
      setCustomerId('')
      setCustomerName('')
      setCustomerPhone('')
      setRedeemPoints(0)
      setPaymentOpen(false)
      setResumingSaleId(null)
      queryClient.invalidateQueries({ queryKey: ['sales', 'held'] })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      inputRef.current?.focus()
    },
    meta: { successMessage: 'Sale completed.' },
  })

  const holdMutation = useMutation({
    mutationFn: () =>
      salesApi.create({
        branch_id: branchId,
        shift_id: shiftId,
        customer_id: customerId || undefined,
        customer_name: customerName || undefined,
        items: cart.map((line) => ({ product_id: line.product.id, quantity: line.quantity, discount_amount: line.discountAmount || undefined })),
        hold: true,
      }),
    onSuccess: () => {
      setCart([])
      setCustomerId('')
      setCustomerName('')
      queryClient.invalidateQueries({ queryKey: ['sales', 'held'] })
    },
    meta: { successMessage: 'Sale held.' },
  })

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id)
      if (existing) {
        return prev.map((l) => (l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l))
      }
      return [...prev, { product, quantity: 1, discountAmount: 0 }]
    })
  }

  function updateQuantity(productId: number, quantity: number) {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((l) => l.product.id !== productId))
      return
    }
    setCart((prev) => prev.map((l) => (l.product.id === productId ? { ...l, quantity } : l)))
  }

  function updateDiscount(productId: number, discountAmount: number) {
    setCart((prev) => prev.map((l) => (l.product.id === productId ? { ...l, discountAmount } : l)))
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && query.trim()) {
      e.preventDefault()
      scanMutation.mutate(query.trim())
    }
  }

  function resumeHeldSale(sale: Sale) {
    // Locks the cart to this held sale's original snapshot (no item edits in Phase
    // 1 — only payment) and routes "Pay" to POST /sales/{id}/complete instead of
    // creating a new sale, so the held row is completed rather than duplicated.
    setResumingSaleId(sale.id)
    setCart(
      (sale.items ?? []).map((item) => ({
        product: {
          id: item.product_id ?? 0,
          uuid: '',
          name: item.product_name,
          description: null,
          sku: item.sku,
          image_url: null,
          category: null,
          brand: null,
          unit: null,
          cost_price: '0',
          selling_price: item.unit_price,
          wholesale_price: null,
          minimum_selling_price: null,
          tax_rate: '0',
          is_tax_inclusive: false,
          discount_percent: null,
          reorder_level: 0,
          max_stock_level: null,
          shelf_location: null,
          has_expiry: false,
          has_batch: false,
          has_serial: false,
          status: 'active',
          barcodes: [],
          created_at: '',
        },
        quantity: item.quantity,
        discountAmount: Number(item.discount_amount),
      })),
    )
    setCustomerId(sale.customer_id ?? '')
    setCustomerName(sale.customer_name ?? '')
  }

  const subtotal = cart.reduce((sum, l) => sum + Number(l.product.selling_price) * l.quantity, 0)
  const discountTotal = cart.reduce((sum, l) => sum + l.discountAmount, 0)
  const taxTotal = cart.reduce((sum, l) => {
    const gross = Number(l.product.selling_price) * l.quantity - l.discountAmount
    const rate = Number(l.product.tax_rate) / 100
    return sum + (l.product.is_tax_inclusive ? gross - gross / (1 + rate) : gross * rate)
  }, 0)
  const grandTotal = subtotal - discountTotal + taxTotal

  return (
    <Grid container spacing={2} sx={{ height: 'calc(100vh - 100px)' }}>
      <Grid size={7} sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <TextField
          inputRef={inputRef}
          fullWidth
          autoFocus
          placeholder="Scan barcode or search products…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleInputKeyDown}
          slotProps={{ input: { startAdornment: <QrCodeScanner sx={{ mr: 1, color: 'text.secondary' }} /> } }}
          sx={{ mb: 2 }}
        />
        {scanError && (
          <Alert severity="warning" onClose={() => setScanError(null)} sx={{ mb: 1 }}>
            {scanError}
          </Alert>
        )}
        {heldQuery.data && heldQuery.data.length > 0 && (
          <Paper variant="outlined" sx={{ p: 1, mb: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Held sales
            </Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
              {heldQuery.data.map((s) => (
                <Chip key={s.id} icon={<PauseCircle />} label={s.receipt_number} size="small" onClick={() => resumeHeldSale(s)} />
              ))}
            </Stack>
          </Paper>
        )}
        <Box sx={{ overflowY: 'auto', flexGrow: 1 }}>
          <Grid container spacing={1.5}>
            {(searchQuery.data?.data ?? []).map((product) => (
              <Grid size={4} key={product.id}>
                <Card variant="outlined">
                  <CardActionArea onClick={() => addToCart(product)} sx={{ p: 1.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                      {product.name}
                    </Typography>
                    <Typography variant="body2" color="primary.main" sx={{ fontWeight: 700 }}>
                      {currency} {Number(product.selling_price).toLocaleString()}
                    </Typography>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Grid>

      <Grid size={5} sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <Paper variant="outlined" sx={{ p: 2, display: 'flex', flexDirection: 'column', flexGrow: 1, minHeight: 0 }}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }} gutterBottom>
              Cart
            </Typography>
            {resumingSaleId && (
              <Chip
                label="Resuming held sale"
                size="small"
                color="warning"
                onDelete={() => {
                  setResumingSaleId(null)
                  setCart([])
                }}
              />
            )}
          </Stack>
          <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
            <TextField
              select
              size="small"
              label="Customer"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value ? Number(e.target.value) : '')}
              fullWidth
            >
              <MenuItem value="">Walk-in</MenuItem>
              {customersQuery.data?.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name} {c.loyalty_points > 0 ? `(${c.loyalty_points} pts)` : ''}
                </MenuItem>
              ))}
            </TextField>
            {!customerId && (
              <>
                <TextField size="small" label="Customer name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} fullWidth />
                <TextField size="small" label="Phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} fullWidth />
              </>
            )}
          </Stack>
          {selectedCustomer && selectedCustomer.loyalty_points > 0 && (
            <TextField
              size="small"
              type="number"
              label={`Redeem points (max ${selectedCustomer.loyalty_points})`}
              value={redeemPoints || ''}
              onChange={(e) => setRedeemPoints(Math.min(Number(e.target.value) || 0, selectedCustomer.loyalty_points))}
              sx={{ mb: 1.5, width: 220 }}
            />
          )}

          <List sx={{ overflowY: 'auto', flexGrow: 1 }}>
            {cart.map((line) => (
              <Box key={line.product.id} sx={{ py: 1, borderBottom: '1px solid #f0f0f0' }}>
                <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" noWrap sx={{ fontWeight: 600, maxWidth: 160 }}>
                    {line.product.name}
                  </Typography>
                  <IconButton size="small" onClick={() => updateQuantity(line.product.id, 0)}>
                    <Delete fontSize="small" />
                  </IconButton>
                </Stack>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 0.5 }}>
                  <IconButton size="small" onClick={() => updateQuantity(line.product.id, line.quantity - 1)}>
                    <Remove fontSize="small" />
                  </IconButton>
                  <Typography variant="body2">{line.quantity}</Typography>
                  <IconButton size="small" onClick={() => updateQuantity(line.product.id, line.quantity + 1)}>
                    <Add fontSize="small" />
                  </IconButton>
                  <Typography variant="body2" sx={{ flexGrow: 1, textAlign: 'right' }}>
                    {currency} {money(Number(line.product.selling_price) * line.quantity - line.discountAmount)}
                  </Typography>
                </Stack>
                {canDiscount && (
                  <TextField
                    size="small"
                    variant="standard"
                    label="Discount"
                    type="number"
                    value={line.discountAmount || ''}
                    onChange={(e) => updateDiscount(line.product.id, Number(e.target.value) || 0)}
                    sx={{ mt: 0.5, width: 120 }}
                  />
                )}
              </Box>
            ))}
            {cart.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 4, textAlign: 'center' }}>
                Cart is empty — scan or select a product.
              </Typography>
            )}
          </List>

          <Box sx={{ pt: 1.5, borderTop: '1px solid #e5e7eb' }}>
            <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
              <Typography variant="body2">Subtotal</Typography>
              <Typography variant="body2">{money(subtotal)}</Typography>
            </Stack>
            {discountTotal > 0 && (
              <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                <Typography variant="body2">Discount</Typography>
                <Typography variant="body2">-{money(discountTotal)}</Typography>
              </Stack>
            )}
            <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
              <Typography variant="body2">Tax</Typography>
              <Typography variant="body2">{money(taxTotal)}</Typography>
            </Stack>
            <Stack direction="row" sx={{ justifyContent: 'space-between', mt: 0.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Total
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                {currency} {money(grandTotal)}
              </Typography>
            </Stack>

            <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
              <Button
                variant="outlined"
                fullWidth
                disabled={cart.length === 0 || !!resumingSaleId}
                loading={holdMutation.isPending}
                onClick={() => holdMutation.mutate()}
              >
                Hold
              </Button>
              <Button variant="contained" fullWidth disabled={cart.length === 0} onClick={() => setPaymentOpen(true)}>
                Pay
              </Button>
            </Stack>
          </Box>
        </Paper>
      </Grid>

      <PaymentDialog
        open={paymentOpen}
        grandTotal={Math.round(grandTotal * 100) / 100}
        currency={currency}
        paymentMethods={paymentMethodsQuery.data ?? []}
        submitting={saleMutation.isPending}
        onClose={() => setPaymentOpen(false)}
        onConfirm={(payments) => saleMutation.mutate(payments)}
      />

      <ReceiptDialog sale={completedSale} onClose={() => setCompletedSale(null)} />
    </Grid>
  )
}

export function PosCheckoutPage() {
  return <OpenShiftGate>{(branchId, shiftId) => <CheckoutScreen branchId={branchId} shiftId={shiftId} />}</OpenShiftGate>
}
