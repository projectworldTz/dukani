import { Add, Delete, PauseCircle, PersonAdd, QrCodeScanner, Remove } from '@mui/icons-material'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardActionArea,
  Chip,
  Grid,
  IconButton,
  List,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useDeferredValue, useEffect, useRef, useState } from 'react'
import { businessApi } from '../../api/endpoints/business'
import { paymentMethodsApi, salesApi } from '../../api/endpoints/sales'
import { customersApi, type CustomerRecord } from '../../api/endpoints/customers'
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
  const canCredit = useAuthStore((s) => s.hasPermission('sales.credit.apply'))

  const [query, setQuery] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [customerId, setCustomerId] = useState<number | ''>('')
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [showWalkInDetails, setShowWalkInDetails] = useState(false)
  const [redeemPoints, setRedeemPoints] = useState(0)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [completedSale, setCompletedSale] = useState<Sale | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  // Set while resuming a previously-held sale — paying then completes THAT sale
  // (POST /sales/{id}/complete) instead of creating a brand new one.
  const [resumingSale, setResumingSale] = useState<Sale | null>(null)
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())
  const inputRef = useRef<HTMLInputElement>(null)
  const deferredCustomerSearch = useDeferredValue(customerSearch)
  const deferredProductSearch = useDeferredValue(query)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const searchQuery = useQuery({
    queryKey: ['products', 'pos-search', branchId, deferredProductSearch],
    queryFn: () => productsApi.list({ search: deferredProductSearch || undefined, status: 'active', branch_id: branchId }),
  })

  const paymentMethodsQuery = useQuery({ queryKey: ['payment-methods'], queryFn: paymentMethodsApi.list })
  const heldQuery = useQuery({ queryKey: ['sales', 'held', branchId], queryFn: () => salesApi.held(branchId) })
  const customersQuery = useQuery({
    queryKey: ['customers', 'pos-search', deferredCustomerSearch],
    queryFn: () => customersApi.list(deferredCustomerSearch || undefined),
  })
  const settingsQuery = useQuery({ queryKey: ['business-settings'], queryFn: businessApi.settings })

  const scanMutation = useMutation({
    mutationFn: (code: string) => productsApi.scan(code, branchId),
    onSuccess: (product) => {
      setScanError(null)
      addToCart(product)
      setQuery('')
      inputRef.current?.focus()
    },
    onError: () => setScanError('Product not found for that code.'),
    meta: { suppressErrorToast: true },
  })

  const saleMutation = useMutation({
    mutationFn: (payments: PaymentLine[]) =>
      resumingSale
        ? salesApi.complete(resumingSale.id, payments, redeemPoints || undefined)
        : salesApi.create({
            branch_id: branchId,
            shift_id: shiftId,
            customer_id: customerId || undefined,
            customer_name: customerName || undefined,
            customer_phone: customerPhone || undefined,
            redeem_points: redeemPoints || undefined,
            idempotency_key: idempotencyKey,
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
      setSelectedCustomer(null)
      setCustomerName('')
      setCustomerPhone('')
      setShowWalkInDetails(false)
      setRedeemPoints(0)
      setPaymentOpen(false)
      setResumingSale(null)
      setIdempotencyKey(crypto.randomUUID())
      queryClient.invalidateQueries({ queryKey: ['sales', 'held'] })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['products', 'pos-search'] })
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
        customer_phone: customerPhone || undefined,
        idempotency_key: idempotencyKey,
        items: cart.map((line) => ({ product_id: line.product.id, quantity: line.quantity, discount_amount: line.discountAmount || undefined })),
        hold: true,
      }),
    onSuccess: () => {
      setCart([])
      setCustomerId('')
      setSelectedCustomer(null)
      setCustomerName('')
      setCustomerPhone('')
      setRedeemPoints(0)
      setShowWalkInDetails(false)
      setIdempotencyKey(crypto.randomUUID())
      queryClient.invalidateQueries({ queryKey: ['sales', 'held'] })
    },
    meta: { successMessage: 'Sale held.' },
  })

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (event.key === 'F2') {
        event.preventDefault()
        inputRef.current?.focus()
      }
      if (event.key === 'F4' && cart.length > 0) {
        event.preventDefault()
        setPaymentOpen(true)
      }
      if (event.key === 'F6' && cart.length > 0 && !resumingSale && !holdMutation.isPending) {
        event.preventDefault()
        holdMutation.mutate()
      }
      if (event.key === 'Escape' && paymentOpen && !saleMutation.isPending) {
        setPaymentOpen(false)
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [cart.length, holdMutation, paymentOpen, resumingSale, saleMutation.isPending])

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id)
      const nextQuantity = (existing?.quantity ?? 0) + 1
      if (product.available_stock !== undefined && nextQuantity > product.available_stock) {
        setScanError(`Only ${product.available_stock} unit${product.available_stock === 1 ? '' : 's'} of ${product.name} available at this branch.`)
        return prev
      }
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
    setCart((prev) => prev.map((line) => {
      if (line.product.id !== productId) return line
      const available = line.product.available_stock
      if (available !== undefined && quantity > available) {
        setScanError(`Only ${available} unit${available === 1 ? '' : 's'} of ${line.product.name} available.`)
        return { ...line, quantity: available }
      }
      return { ...line, quantity }
    }))
  }

  function updateDiscount(productId: number, discountAmount: number) {
    setCart((prev) => prev.map((line) => line.product.id === productId
      ? { ...line, discountAmount: Math.min(Math.max(0, discountAmount), Number(line.product.selling_price) * line.quantity) }
      : line))
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
    setResumingSale(sale)
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
    setSelectedCustomer(customersQuery.data?.find((customer) => customer.id === sale.customer_id) ?? null)
    setCustomerName(sale.customer_name ?? '')
    setCustomerPhone(sale.customer_phone ?? '')
    setCustomerSearch(sale.customer_name ?? '')
  }

  const calculatedSubtotal = cart.reduce((sum, l) => sum + Number(l.product.selling_price) * l.quantity, 0)
  const calculatedDiscountTotal = cart.reduce((sum, l) => sum + l.discountAmount, 0)
  const calculatedTaxTotal = cart.reduce((sum, l) => {
    const gross = Number(l.product.selling_price) * l.quantity - l.discountAmount
    const rate = Number(l.product.tax_rate) / 100
    return sum + (l.product.is_tax_inclusive ? gross - gross / (1 + rate) : gross * rate)
  }, 0)
  const subtotal = resumingSale ? Number(resumingSale.subtotal) : calculatedSubtotal
  const discountTotal = resumingSale ? Number(resumingSale.discount_total) : calculatedDiscountTotal
  const taxTotal = resumingSale ? Number(resumingSale.tax_total) : calculatedTaxTotal
  const grandTotal = resumingSale ? Number(resumingSale.grand_total) : subtotal - discountTotal + taxTotal
  const loyaltyPointValue = Number(settingsQuery.data?.settings?.loyalty_point_value ?? 0)
  const loyaltyDiscount = Math.min(grandTotal, redeemPoints * loyaltyPointValue)
  const amountDue = Math.max(0, Math.round((grandTotal - loyaltyDiscount) * 100) / 100)

  return (
    <Grid container spacing={2} sx={{ height: { xs: 'auto', md: 'calc(100vh - 100px)' } }}>
      <Grid size={{ xs: 12, md: 7 }} sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <TextField
          inputRef={inputRef}
          fullWidth
          autoFocus
          placeholder="Scan barcode or search products…"
          value={query}
          disabled={!!resumingSale}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleInputKeyDown}
          slotProps={{ input: { startAdornment: <QrCodeScanner sx={{ mr: 1, color: 'text.secondary' }} /> } }}
          sx={{ mb: 2 }}
          helperText="F2 focuses search · scan a barcode and press Enter"
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
                <Chip
                  key={s.id}
                  icon={<PauseCircle />}
                  label={`${s.customer_name || 'Walk-in'} · ${currency} ${Number(s.grand_total).toLocaleString()} · ${new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                  size="small"
                  onClick={() => resumeHeldSale(s)}
                />
              ))}
            </Stack>
          </Paper>
        )}
        <Box sx={{ overflowY: 'auto', flexGrow: 1 }}>
          <Grid container spacing={1.5}>
            {(searchQuery.data?.data ?? []).map((product) => (
              <Grid size={4} key={product.id}>
                <Card variant="outlined">
                  <CardActionArea disabled={!!resumingSale || (product.available_stock ?? 0) <= 0} onClick={() => addToCart(product)} sx={{ p: 1.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                      {product.name}
                    </Typography>
                    <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" color="primary.main" sx={{ fontWeight: 700 }}>
                        {currency} {Number(product.selling_price).toLocaleString()}
                      </Typography>
                      <Chip
                        size="small"
                        label={`${product.available_stock ?? 0} in stock`}
                        color={(product.available_stock ?? 0) > 0 ? 'default' : 'error'}
                        variant="outlined"
                      />
                    </Stack>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Grid>

      <Grid size={{ xs: 12, md: 5 }} sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <Paper variant="outlined" sx={{ p: 2, display: 'flex', flexDirection: 'column', flexGrow: 1, minHeight: 0 }}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }} gutterBottom>
              Cart
            </Typography>
            {resumingSale && (
              <Chip
                label="Resuming held sale"
                size="small"
                color="warning"
                onDelete={() => {
                  setResumingSale(null)
                  setCart([])
                }}
              />
            )}
          </Stack>
          <Stack spacing={1} sx={{ mb: 1.5 }}>
            <Stack direction="row" spacing={1}>
              <Autocomplete
                size="small"
                fullWidth
                options={customersQuery.data ?? []}
                value={selectedCustomer ?? null}
                inputValue={customerSearch}
                loading={customersQuery.isFetching}
                disabled={!!resumingSale}
                getOptionLabel={(customer) => `${customer.name}${customer.phone ? ` · ${customer.phone}` : ''}`}
                onInputChange={(_, value, reason) => {
                  setCustomerSearch(value)
                  if (reason === 'input' && selectedCustomer) {
                    setCustomerId('')
                    setSelectedCustomer(null)
                    setRedeemPoints(0)
                  }
                }}
                onChange={(_, customer) => {
                  setCustomerId(customer?.id ?? '')
                  setSelectedCustomer(customer)
                  setRedeemPoints(0)
                }}
                renderInput={(params) => <TextField {...params} label="Customer (optional)" placeholder="Walk-in customer" />}
              />
              {!customerId && (
                <Button disabled={!!resumingSale} startIcon={<PersonAdd />} variant="outlined" onClick={() => setShowWalkInDetails((shown) => !shown)} sx={{ whiteSpace: 'nowrap' }}>
                  Add details
                </Button>
              )}
            </Stack>
            {!customerId && showWalkInDetails && (
              <Stack direction="row" spacing={1}>
                <TextField size="small" label="Customer name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} fullWidth />
                <TextField size="small" label="Phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} fullWidth />
              </Stack>
            )}
          </Stack>
          {selectedCustomer && selectedCustomer.loyalty_points > 0 && (
            <TextField
              size="small"
              type="number"
              label={`Redeem points (max ${selectedCustomer.loyalty_points})`}
              value={redeemPoints || ''}
              onChange={(e) => setRedeemPoints(Math.min(Number(e.target.value) || 0, selectedCustomer.loyalty_points))}
              helperText={loyaltyPointValue > 0 && redeemPoints > 0 ? `Saves ${currency} ${loyaltyDiscount.toLocaleString()}` : 'Enter points to use on this sale'}
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
                  <IconButton size="small" disabled={!!resumingSale} onClick={() => updateQuantity(line.product.id, 0)}>
                    <Delete fontSize="small" />
                  </IconButton>
                </Stack>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 0.5 }}>
                  <IconButton size="small" disabled={!!resumingSale} onClick={() => updateQuantity(line.product.id, line.quantity - 1)}>
                    <Remove fontSize="small" />
                  </IconButton>
                  <TextField
                    size="small"
                    type="number"
                    value={line.quantity}
                    disabled={!!resumingSale}
                    onChange={(event) => updateQuantity(line.product.id, Math.max(0, Math.floor(Number(event.target.value))))}
                    slotProps={{ htmlInput: { min: 1, max: line.product.available_stock, style: { textAlign: 'center', width: 42, padding: 6 } } }}
                  />
                  <IconButton size="small" disabled={!!resumingSale} onClick={() => updateQuantity(line.product.id, line.quantity + 1)}>
                    <Add fontSize="small" />
                  </IconButton>
                  <Typography variant="body2" sx={{ flexGrow: 1, textAlign: 'right' }}>
                    {currency} {money(Number(line.product.selling_price) * line.quantity - line.discountAmount)}
                  </Typography>
                </Stack>
                {canDiscount && !resumingSale && (
                  <TextField
                    size="small"
                    variant="standard"
                    label="Line discount"
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
            {loyaltyDiscount > 0 && (
              <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                <Typography variant="body2">Loyalty reward</Typography>
                <Typography variant="body2" color="success.main">-{money(loyaltyDiscount)}</Typography>
              </Stack>
            )}
            <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
              <Typography variant="body2">Tax</Typography>
              <Typography variant="body2">{money(taxTotal)}</Typography>
            </Stack>
            <Stack direction="row" sx={{ justifyContent: 'space-between', mt: 0.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                {loyaltyDiscount > 0 ? 'Amount due' : 'Total'}
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                {currency} {money(amountDue)}
              </Typography>
            </Stack>

            <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
              <Button
                variant="outlined"
                fullWidth
                disabled={cart.length === 0 || !!resumingSale}
                loading={holdMutation.isPending}
                onClick={() => holdMutation.mutate()}
              >
                Hold
              </Button>
              <Button variant="contained" fullWidth disabled={cart.length === 0 || paymentMethodsQuery.isLoading || (paymentMethodsQuery.data?.length ?? 0) === 0} onClick={() => setPaymentOpen(true)}>
                Pay {currency} {money(amountDue)}
              </Button>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75, textAlign: 'center' }}>
              F4 pay · F6 hold sale
            </Typography>
            {cart.length > 0 && !resumingSale && (
              <Button
                color="inherit"
                size="small"
                onClick={() => {
                  if (window.confirm('Clear every item from this sale?')) {
                    setCart([])
                    setCustomerId('')
                    setSelectedCustomer(null)
                    setCustomerName('')
                    setCustomerPhone('')
                    setRedeemPoints(0)
                    setIdempotencyKey(crypto.randomUUID())
                  }
                }}
                sx={{ mt: 1 }}
              >
                Clear sale
              </Button>
            )}
          </Box>
        </Paper>
      </Grid>

      {paymentOpen && (
        <PaymentDialog
          open
          grandTotal={amountDue}
          currency={currency}
          paymentMethods={paymentMethodsQuery.data ?? []}
          submitting={saleMutation.isPending}
          creditAllowed={canCredit && !!selectedCustomer}
          customerName={selectedCustomer?.name}
          availableCredit={Math.max(0, Number(selectedCustomer?.credit_limit ?? 0) - Number(selectedCustomer?.outstanding_balance ?? 0))}
          onClose={() => setPaymentOpen(false)}
          onConfirm={(payments) => saleMutation.mutate(payments)}
        />
      )}

      {completedSale && <ReceiptDialog sale={completedSale} onClose={() => setCompletedSale(null)} onFiscalized={setCompletedSale} />}
    </Grid>
  )
}

export function PosCheckoutPage() {
  return <OpenShiftGate>{(branchId, shiftId) => <CheckoutScreen branchId={branchId} shiftId={shiftId} />}</OpenShiftGate>
}
