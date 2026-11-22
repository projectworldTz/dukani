import {
  Add,
  Close,
  DeleteOutlined,
  KeyboardArrowUp,
  LocalOffer,
  Logout,
  PauseCircleOutlined,
  Person,
  PersonOutlined,
  QrCodeScanner,
  Remove,
  ShoppingCartOutlined,
} from '@mui/icons-material'
import {
  Alert,
  Badge,
  Box,
  Button,
  ButtonBase,
  Chip,
  Collapse,
  Drawer,
  IconButton,
  InputAdornment,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Skeleton,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useDeferredValue, useEffect, useRef, useState } from 'react'
import { businessApi } from '../../api/endpoints/business'
import type { CustomerRecord } from '../../api/endpoints/customers'
import { customersApi } from '../../api/endpoints/customers'
import { categoriesApi, productsApi } from '../../api/endpoints/products'
import { paymentMethodsApi, salesApi } from '../../api/endpoints/sales'
import { useAuthStore } from '../../stores/authStore'
import { useCalculatorStore } from '../../components/calculator/calculatorStore'
import type { CartLine, Product, Sale } from '../../types'
import { CustomerPickerDialog } from './CustomerPickerDialog'
import { EndShiftDialog } from './EndShiftDialog'
import { OpenShiftGate } from './OpenShiftGate'
import { PaymentDialog, type PaymentLine } from './PaymentDialog'
import { initials, money, tileColors } from './posUtils'
import { ReceiptDialog } from './ReceiptDialog'
import { PrescriptionDialog } from './PrescriptionDialog'
import { DosageDialog } from './DosageDialog'
import { WeighDialog } from './WeighDialog'
import { formatQty, gramsToKg, isWeighed, linePrice } from '../../utils/quantity'
import { ScaleRounded } from '@mui/icons-material'
import { usePlatform } from '../../hooks/usePlatform'
import { medicineSubtitle } from '../../api/endpoints/pharmacy'
import { AssignmentOutlined, MedicationRounded } from '@mui/icons-material'
import type { Prescription } from '../../types'

/** A held sale's items, reshaped into cart lines (prices are locked to the held snapshot). */
function heldSaleToCart(sale: Sale): CartLine[] {
  return (sale.items ?? []).map((item) => ({
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
      sold_by_weight: (item.price_divisor ?? 1) > 1,
    },
    quantity: item.quantity,
    discountAmount: Number(item.discount_amount),
    dosage: item.dosage_instructions ?? undefined,
  }))
}

/** Units that can be sold now — expired medicine never counts. */
const sellableStock = (p: Product) => Math.max(0, (p.available_stock ?? 0) - (p.expired_stock ?? 0))

function ProductTile({ product, currency, disabled, inCart, onAdd }: { product: Product; currency: string; disabled: boolean; inCart: number; onAdd: () => void }) {
  const stock = sellableStock(product)
  const soldOut = stock <= 0
  const colors = tileColors(product.name)
  return (
    <ButtonBase
      onClick={onAdd}
      disabled={disabled || soldOut}
      sx={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        textAlign: 'left',
        borderRadius: 3,
        overflow: 'hidden',
        bgcolor: 'background.paper',
        border: '2px solid',
        borderColor: inCart ? 'primary.main' : 'divider',
        opacity: soldOut ? 0.55 : 1,
        transition: 'border-color .15s, box-shadow .15s, transform .08s',
        '&:hover': { borderColor: 'primary.light', boxShadow: '0 4px 14px rgba(16,24,40,0.08)' },
        '&:active': { transform: 'scale(0.98)' },
      }}
    >
      <Box sx={{ height: { xs: 64, sm: 76 }, bgcolor: colors.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {product.image_url ? (
          <Box component="img" src={product.image_url} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <Typography sx={{ fontWeight: 800, fontSize: 24, color: colors.fg }}>{initials(product.name)}</Typography>
        )}
      </Box>
      <Box sx={{ p: 1.25, flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 14, lineHeight: 1.25, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 35 }}>
          {product.name}
        </Typography>
        {medicineSubtitle(product) && (
          <Typography variant="caption" color="text.secondary" noWrap sx={{ mt: -0.25 }}>
            {medicineSubtitle(product)}
          </Typography>
        )}
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline', mt: 'auto', gap: 0.5 }}>
          <Typography sx={{ fontWeight: 800, color: 'primary.main', fontSize: 15 }} noWrap>
            {currency} {money(Number(product.selling_price))}
            {isWeighed(product) && <Box component="span" sx={{ fontSize: 12, fontWeight: 600 }}>/kg</Box>}
          </Typography>
          <Typography variant="caption" sx={{ color: soldOut ? 'error.main' : stock <= product.reorder_level ? 'warning.dark' : 'text.secondary', fontWeight: 600, whiteSpace: 'nowrap' }}>
            {soldOut ? ((product.expired_stock ?? 0) > 0 ? 'Expired' : 'Sold out') : `${formatQty(stock, isWeighed(product))} left`}
          </Typography>
        </Stack>
      </Box>
      {product.requires_prescription && (
        <Box sx={{ position: 'absolute', top: 6, left: 6, px: 0.75, height: 22, borderRadius: 1, bgcolor: product.is_controlled ? 'error.main' : 'primary.main', color: '#fff', fontWeight: 800, fontSize: 11.5, display: 'flex', alignItems: 'center' }}>
          {product.is_controlled ? 'Rx · CD' : 'Rx'}
        </Box>
      )}
      {inCart > 0 && (
        <Box sx={{ position: 'absolute', top: 6, right: 6, minWidth: 26, height: 26, px: 0.75, borderRadius: 13, bgcolor: 'primary.main', color: 'white', fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isWeighed(product) ? `${gramsToKg(inCart)}kg` : inCart}
        </Box>
      )}
    </ButtonBase>
  )
}

function CheckoutScreen({ branchId, shiftId }: { branchId: number; shiftId: number }) {
  const theme = useTheme()
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'))
  const queryClient = useQueryClient()
  const currency = useAuthStore((s) => s.user?.business?.currency ?? '')
  const canDiscount = useAuthStore((s) => s.hasPermission('sales.discount.apply'))
  const canCredit = useAuthStore((s) => s.hasPermission('sales.credit.apply'))

  const [query, setQuery] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [cart, setCart] = useState<CartLine[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null)
  const [redeemPoints, setRedeemPoints] = useState(0)
  const [expandedLine, setExpandedLine] = useState<number | null>(null)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [customerOpen, setCustomerOpen] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [endShiftOpen, setEndShiftOpen] = useState(false)
  const [heldAnchor, setHeldAnchor] = useState<HTMLElement | null>(null)
  const [completedSale, setCompletedSale] = useState<Sale | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  // Set while resuming a previously-held sale — paying then completes THAT sale
  // (POST /sales/{id}/complete) instead of creating a brand new one.
  const [resumingSale, setResumingSale] = useState<Sale | null>(null)
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())
  const { isPharmacy } = usePlatform()
  const [prescription, setPrescription] = useState<Prescription | null>(null)
  const [rxOpen, setRxOpen] = useState(false)
  // After the prescription is saved from the Charge button, carry straight on to payment.
  const [payAfterRx, setPayAfterRx] = useState(false)
  const [dosageFor, setDosageFor] = useState<CartLine | null>(null)
  // Weighed item being weighed (new, or an existing line when editing its weight).
  const [weighFor, setWeighFor] = useState<{ product: Product; grams?: number } | null>(null)
  const weighOpen = weighFor !== null
  const otherDialogOpen = rxOpen || dosageFor !== null
  const inputRef = useRef<HTMLInputElement>(null)
  const scannerBuffer = useRef('')
  const scannerLastKeyAt = useRef(0)
  const deferredProductSearch = useDeferredValue(query)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const searchQuery = useQuery({
    queryKey: ['products', 'pos-search', branchId, deferredProductSearch, categoryId],
    queryFn: () =>
      productsApi.list({
        search: deferredProductSearch || undefined,
        status: 'active',
        branch_id: branchId,
        category_id: categoryId ?? undefined,
        per_page: 60,
      }),
    placeholderData: (prev) => prev,
  })
  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.list })
  const paymentMethodsQuery = useQuery({ queryKey: ['payment-methods'], queryFn: paymentMethodsApi.list })
  const heldQuery = useQuery({ queryKey: ['sales', 'held', branchId], queryFn: () => salesApi.held(branchId) })
  const settingsQuery = useQuery({ queryKey: ['business-settings'], queryFn: businessApi.settings })

  const products = searchQuery.data?.data ?? []
  const heldSales = heldQuery.data ?? []
  const activeMethods = (paymentMethodsQuery.data ?? []).filter((m) => m.is_active)

  function resetSale() {
    setCart([])
    setSelectedCustomer(null)
    setRedeemPoints(0)
    setExpandedLine(null)
    setResumingSale(null)
    setPrescription(null)
    setIdempotencyKey(crypto.randomUUID())
  }

  const scanMutation = useMutation({
    mutationFn: (code: string) => productsApi.scan(code, branchId),
    onSuccess: (product) => {
      setScanError(null)
      if (isWeighed(product)) setWeighFor({ product })
      else addToCart(product)
      setQuery('')
      inputRef.current?.focus()
    },
    onError: (_, code) => setScanError(`No product found for “${code}”. Check the code or search by name.`),
    meta: { suppressErrorToast: true },
  })

  const saleMutation = useMutation({
    mutationFn: (payments: PaymentLine[]) =>
      resumingSale
        ? salesApi.complete(resumingSale.id, payments, redeemPoints || undefined)
        : salesApi.create({
            branch_id: branchId,
            shift_id: shiftId,
            customer_id: selectedCustomer?.id,
            redeem_points: redeemPoints || undefined,
            idempotency_key: idempotencyKey,
            items: cart.map((line) => ({
              product_id: line.product.id,
              quantity: line.quantity,
              discount_amount: line.discountAmount || undefined,
              dosage_instructions: line.dosage || undefined,
            })),
            prescription: prescription ?? undefined,
            payments,
          }),
    onSuccess: (sale) => {
      setCompletedSale(sale)
      resetSale()
      setPaymentOpen(false)
      setCartOpen(false)
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })

  const holdMutation = useMutation({
    mutationFn: () =>
      salesApi.create({
        branch_id: branchId,
        shift_id: shiftId,
        customer_id: selectedCustomer?.id,
        idempotency_key: idempotencyKey,
        items: cart.map((line) => ({ product_id: line.product.id, quantity: line.quantity, discount_amount: line.discountAmount || undefined, dosage_instructions: line.dosage || undefined })),
        prescription: prescription ?? undefined,
        hold: true,
      }),
    onSuccess: () => {
      resetSale()
      setCartOpen(false)
      queryClient.invalidateQueries({ queryKey: ['sales', 'held'] })
      inputRef.current?.focus()
    },
    meta: { successMessage: 'Sale put on hold. Find it under “Held sales”.' },
  })

  // The F4 shortcut always calls the latest startCharge (which depends on the cart/prescription).
  const startChargeRef = useRef<() => void>(() => undefined)

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (useCalculatorStore.getState().open) return
      if (event.key === 'F2') {
        event.preventDefault()
        inputRef.current?.focus()
      }
      if (event.key === 'F4' && cart.length > 0 && !completedSale) {
        event.preventDefault()
        startChargeRef.current()
      }
      if (event.key === 'F6' && cart.length > 0 && !resumingSale && !holdMutation.isPending) {
        event.preventDefault()
        holdMutation.mutate()
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [cart.length, completedSale, holdMutation, resumingSale])

  // Hardware barcode scanners "type" fast and end with Enter. Capture that anywhere on
  // the page (not just in the search box) so a scan always lands in the cart.
  useEffect(() => {
    function captureScanner(event: KeyboardEvent) {
      if (useCalculatorStore.getState().open) return
      if (paymentOpen || customerOpen || endShiftOpen || weighOpen || otherDialogOpen || completedSale || resumingSale || scanMutation.isPending || event.ctrlKey || event.altKey || event.metaKey) return

      const target = event.target as HTMLElement | null
      if (target?.matches('input, textarea, [contenteditable="true"]')) return

      const now = performance.now()
      if (now - scannerLastKeyAt.current > 120) scannerBuffer.current = ''
      scannerLastKeyAt.current = now

      if (event.key === 'Enter') {
        const code = scannerBuffer.current.trim()
        scannerBuffer.current = ''
        if (code.length >= 3) {
          event.preventDefault()
          scanMutation.mutate(code)
        }
        return
      }

      if (event.key.length === 1) scannerBuffer.current += event.key
    }

    window.addEventListener('keydown', captureScanner)
    return () => window.removeEventListener('keydown', captureScanner)
  }, [completedSale, customerOpen, endShiftOpen, paymentOpen, resumingSale, scanMutation, weighOpen, otherDialogOpen])

  /** Adds one unit — or, for a weighed product, `amount` grams. */
  function addToCart(product: Product, amount = 1) {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id)
      const nextQuantity = (existing?.quantity ?? 0) + amount
      if (product.available_stock !== undefined && nextQuantity > sellableStock(product)) {
        const left = formatQty(sellableStock(product), isWeighed(product))
        setScanError(`Only ${left} of ${product.name} can be sold${(product.expired_stock ?? 0) > 0 ? ` (${product.expired_stock} more are expired)` : ''}.`)
        return prev
      }
      if (existing) {
        return prev.map((l) => (l.product.id === product.id ? { ...l, quantity: l.quantity + amount } : l))
      }
      return [...prev, { product, quantity: amount, discountAmount: 0 }]
    })
  }

  function updateQuantity(productId: number, quantity: number) {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((l) => l.product.id !== productId))
      return
    }
    setCart((prev) =>
      prev.map((line) => {
        if (line.product.id !== productId) return line
        const available = line.product.available_stock === undefined ? undefined : sellableStock(line.product)
        if (available !== undefined && quantity > available) {
          setScanError(`Only ${available} ${line.product.name} left in stock.`)
          return { ...line, quantity: available }
        }
        return { ...line, quantity, discountAmount: Math.min(line.discountAmount, Number(line.product.selling_price) * quantity) }
      }),
    )
  }

  function updateDiscount(productId: number, discountAmount: number) {
    setCart((prev) =>
      prev.map((line) =>
        line.product.id === productId
          ? { ...line, discountAmount: Math.min(Math.max(0, discountAmount), linePrice(Number(line.product.selling_price), line.quantity, isWeighed(line.product))) }
          : line,
      ),
    )
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter' || !query.trim() || scanMutation.isPending) return
    e.preventDefault()
    // A single search hit is added straight away; otherwise treat the text as a barcode.
    if (products.length === 1 && deferredProductSearch === query) {
      addToCart(products[0])
      setQuery('')
    } else {
      scanMutation.mutate(query.trim())
    }
  }

  function resumeHeldSale(sale: Sale) {
    // Locks the cart to this held sale's original snapshot (only payment can change)
    // and routes "Pay" to POST /sales/{id}/complete, so the held row is completed
    // rather than duplicated.
    setResumingSale(sale)
    setCart(heldSaleToCart(sale))
    setRedeemPoints(0)
    setHeldAnchor(null)
    if (sale.customer_id) {
      customersApi
        .list(sale.customer_name ?? undefined)
        .then((list) => setSelectedCustomer(list.find((c) => c.id === sale.customer_id) ?? null))
        .catch(() => setSelectedCustomer(null))
    } else {
      setSelectedCustomer(null)
    }
  }

  function clearSale() {
    if (cart.length === 0 || window.confirm('Remove all items from this sale?')) resetSale()
  }

  const lineGross = (l: CartLine) => linePrice(Number(l.product.selling_price), l.quantity, isWeighed(l.product))
  const calculatedSubtotal = cart.reduce((sum, l) => sum + lineGross(l), 0)
  const calculatedDiscountTotal = cart.reduce((sum, l) => sum + l.discountAmount, 0)
  const calculatedTaxTotal = cart.reduce((sum, l) => {
    const gross = lineGross(l) - l.discountAmount
    const rate = Number(l.product.tax_rate) / 100
    return sum + (l.product.is_tax_inclusive ? gross - gross / (1 + rate) : gross * rate)
  }, 0)
  const subtotal = resumingSale ? Number(resumingSale.subtotal) : calculatedSubtotal
  const discountTotal = resumingSale ? Number(resumingSale.discount_total) : calculatedDiscountTotal
  const taxTotal = resumingSale ? Number(resumingSale.tax_total) : calculatedTaxTotal
  const grandTotal = resumingSale ? Number(resumingSale.grand_total) : subtotal - discountTotal + taxTotal
  const loyaltyEnabled = !!settingsQuery.data?.settings?.loyalty_enabled
  const loyaltyPointValue = Number(settingsQuery.data?.settings?.loyalty_point_value ?? 0)
  const loyaltyDiscount = Math.min(grandTotal, redeemPoints * loyaltyPointValue)
  const amountDue = Math.max(0, Math.round((grandTotal - loyaltyDiscount) * 100) / 100)
  // A weighed line counts as one item, whatever it weighs.
  const itemCount = cart.reduce((sum, l) => sum + (isWeighed(l.product) ? 1 : l.quantity), 0)
  const cartQty = (productId: number) => cart.find((l) => l.product.id === productId)?.quantity ?? 0
  const canPay = cart.length > 0 && activeMethods.length > 0
  // Pharmacy: prescription-only medicines in the cart need a prescription before payment.
  const rxMedicines = isPharmacy && !resumingSale ? cart.filter((l) => l.product.requires_prescription).map((l) => l.product.name) : []
  const needsRx = rxMedicines.length > 0 && !prescription

  function startCharge() {
    if (needsRx) {
      setPayAfterRx(true)
      setRxOpen(true)
    } else {
      setPaymentOpen(true)
    }
  }
  useEffect(() => {
    startChargeRef.current = startCharge
  })
  const locked = !!resumingSale

  const cartPanel = (
    <Paper
      variant="outlined"
      sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, borderRadius: { xs: 0, md: 3 }, border: { xs: 0, md: '1px solid' }, borderColor: { md: 'divider' }, overflow: 'hidden' }}
    >
      {/* Header: who is buying */}
      <Box sx={{ p: 2, pb: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1.25 }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            Current sale
          </Typography>
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
            {locked && <Chip label="Held sale" size="small" color="warning" onDelete={resetSale} />}
            {!isDesktop && (
              <IconButton aria-label="Close sale panel" onClick={() => setCartOpen(false)}>
                <Close />
              </IconButton>
            )}
          </Stack>
        </Stack>
        {/* The remove (×) button sits beside the customer button, not inside it — nested buttons are invalid HTML. */}
        <Stack
          direction="row"
          sx={{ alignItems: 'center', borderRadius: 2, border: '1px dashed', borderColor: selectedCustomer ? 'primary.main' : 'divider', bgcolor: selectedCustomer ? 'rgba(37, 99, 235,0.05)' : 'transparent' }}
        >
          <ButtonBase
            onClick={() => setCustomerOpen(true)}
            disabled={locked}
            sx={{ flexGrow: 1, minWidth: 0, justifyContent: 'flex-start', gap: 1.25, p: 1.25, borderRadius: 2, textAlign: 'left' }}
          >
            {selectedCustomer ? <Person color="primary" /> : <PersonOutlined color="action" />}
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 14 }} noWrap>
                {selectedCustomer?.name ?? 'Walk-in customer'}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap component="div">
                {selectedCustomer
                  ? [selectedCustomer.phone, selectedCustomer.loyalty_points > 0 ? `${selectedCustomer.loyalty_points} points` : null].filter(Boolean).join(' · ') || 'Saved customer'
                  : 'Tap to add a customer (optional)'}
              </Typography>
            </Box>
          </ButtonBase>
          {selectedCustomer && !locked && (
            <IconButton
              size="small"
              aria-label="Remove customer"
              onClick={() => {
                setSelectedCustomer(null)
                setRedeemPoints(0)
              }}
              sx={{ mr: 0.75 }}
            >
              <Close fontSize="small" />
            </IconButton>
          )}
        </Stack>
      </Box>

      {/* Items */}
      <Box sx={{ flexGrow: 1, overflowY: 'auto', minHeight: 120 }}>
        {cart.length === 0 ? (
          <Box sx={{ py: 6, px: 3, textAlign: 'center', color: 'text.secondary' }}>
            <ShoppingCartOutlined sx={{ fontSize: 48, opacity: 0.4 }} />
            <Typography sx={{ fontWeight: 700, mt: 1, color: 'text.primary' }}>No items yet</Typography>
            <Typography variant="body2">{isPharmacy ? 'Tap a medicine or scan its barcode to add it here.' : 'Tap a product or scan a barcode to add it here.'}</Typography>
          </Box>
        ) : (
          cart.map((line) => {
            const lineTotal = lineGross(line) - line.discountAmount
            const expanded = expandedLine === line.product.id
            return (
              <Box key={line.product.id} sx={{ px: 2, py: 1.25, borderBottom: '1px solid', borderColor: 'divider', bgcolor: expanded ? 'grey.50' : 'transparent' }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <Box sx={{ flexGrow: 1, minWidth: 0, cursor: locked ? 'default' : 'pointer' }} onClick={() => !locked && setExpandedLine(expanded ? null : line.product.id)}>
                    <Typography sx={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3 }}>{line.product.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {currency} {money(Number(line.product.selling_price))} {isWeighed(line.product) ? 'per kg' : 'each'}
                      {line.discountAmount > 0 && (
                        <Box component="span" sx={{ color: 'success.main', fontWeight: 600 }}>
                          {' '}· −{money(line.discountAmount)} off
                        </Box>
                      )}
                    </Typography>
                  </Box>
                  {isWeighed(line.product) ? (
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={locked}
                      startIcon={<ScaleRounded />}
                      onClick={() => setWeighFor({ product: line.product, grams: line.quantity })}
                      sx={{ borderRadius: 5, fontWeight: 800, whiteSpace: 'nowrap', px: 1.5 }}
                      aria-label={`Weight of ${line.product.name}`}
                    >
                      {gramsToKg(line.quantity)} kg
                    </Button>
                  ) : (
                  <Stack direction="row" sx={{ alignItems: 'center', border: '1px solid', borderColor: 'divider', borderRadius: 5, bgcolor: 'background.paper' }}>
                    <IconButton size="small" aria-label={`One less ${line.product.name}`} disabled={locked} onClick={() => updateQuantity(line.product.id, line.quantity - 1)}>
                      {line.quantity === 1 ? <DeleteOutlined fontSize="small" /> : <Remove fontSize="small" />}
                    </IconButton>
                    <Box
                      component="input"
                      type="number"
                      aria-label={`Quantity of ${line.product.name}`}
                      value={line.quantity}
                      disabled={locked}
                      onFocus={(e: React.FocusEvent<HTMLInputElement>) => e.target.select()}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateQuantity(line.product.id, Math.max(0, Math.floor(Number(e.target.value))))}
                      sx={{ width: 36, border: 0, textAlign: 'center', fontWeight: 800, fontSize: 15, bgcolor: 'transparent', MozAppearance: 'textfield', '&::-webkit-inner-spin-button, &::-webkit-outer-spin-button': { WebkitAppearance: 'none', m: 0 }, '&:focus': { outline: 'none' } }}
                    />
                    <IconButton size="small" aria-label={`One more ${line.product.name}`} disabled={locked} onClick={() => updateQuantity(line.product.id, line.quantity + 1)}>
                      <Add fontSize="small" />
                    </IconButton>
                  </Stack>
                  )}
                  <Typography sx={{ fontWeight: 800, minWidth: 72, textAlign: 'right', fontSize: 14 }}>{money(lineTotal)}</Typography>
                </Stack>
                {isPharmacy && !locked && (
                  <ButtonBase
                    onClick={() => setDosageFor(line)}
                    sx={{ mt: 0.75, px: 1, py: 0.4, borderRadius: 1.5, gap: 0.5, maxWidth: '100%', justifyContent: 'flex-start', bgcolor: line.dosage ? '#F0FDFA' : 'transparent', border: '1px dashed', borderColor: line.dosage ? 'primary.light' : 'divider', color: line.dosage ? 'primary.dark' : 'text.secondary' }}
                  >
                    <MedicationRounded sx={{ fontSize: 16, flexShrink: 0 }} />
                    <Typography variant="caption" sx={{ fontWeight: 600, textAlign: 'left' }} noWrap>
                      {line.dosage || 'Add dosage instructions'}
                    </Typography>
                  </ButtonBase>
                )}
                {isPharmacy && locked && line.dosage && (
                  <Typography variant="caption" color="primary.dark" sx={{ display: 'block', mt: 0.5, fontWeight: 600 }}>
                    {line.dosage}
                  </Typography>
                )}
                <Collapse in={expanded} unmountOnExit>
                  <Stack direction="row" spacing={1} sx={{ mt: 1.25, alignItems: 'center' }}>
                    {canDiscount && (
                      <TextField
                        size="small"
                        label="Discount on this item"
                        type="number"
                        value={line.discountAmount || ''}
                        onChange={(e) => updateDiscount(line.product.id, Number(e.target.value) || 0)}
                        slotProps={{ input: { startAdornment: <InputAdornment position="start"><LocalOffer fontSize="small" /></InputAdornment> }, htmlInput: { min: 0 } }}
                        sx={{ flexGrow: 1 }}
                      />
                    )}
                    <Button color="error" startIcon={<DeleteOutlined />} onClick={() => updateQuantity(line.product.id, 0)} sx={{ whiteSpace: 'nowrap' }}>
                      Remove
                    </Button>
                  </Stack>
                </Collapse>
              </Box>
            )
          })
        )}
      </Box>

      {/* Totals + actions */}
      <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'grey.50' }}>
        {rxMedicines.length > 0 && (
          <ButtonBase
            onClick={() => {
              setPayAfterRx(false)
              setRxOpen(true)
            }}
            sx={{ width: '100%', mb: 1.5, p: 1.25, gap: 1.25, borderRadius: 2, justifyContent: 'flex-start', textAlign: 'left', border: '1px solid', borderColor: prescription ? 'primary.light' : 'warning.main', bgcolor: prescription ? '#F0FDFA' : '#FFFBEB' }}
          >
            <AssignmentOutlined sx={{ color: prescription ? 'primary.main' : 'warning.dark' }} />
            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 14 }} noWrap>
                {prescription ? `Rx ${prescription.rx_number} · ${prescription.patient_name}` : 'Prescription required'}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap component="div">
                {prescription ? `Dr. ${prescription.prescriber_name.replace(/^dr\.?\s*/i, '')} · tap to edit` : `For ${rxMedicines.join(', ')} · tap to add`}
              </Typography>
            </Box>
          </ButtonBase>
        )}
        {selectedCustomer && loyaltyEnabled && loyaltyPointValue > 0 && selectedCustomer.loyalty_points > 0 && (
          <TextField
            size="small"
            type="number"
            fullWidth
            label={`Use loyalty points (has ${selectedCustomer.loyalty_points})`}
            value={redeemPoints || ''}
            onChange={(e) => setRedeemPoints(Math.max(0, Math.min(Math.floor(Number(e.target.value)) || 0, selectedCustomer.loyalty_points)))}
            helperText={redeemPoints > 0 ? `Saves ${currency} ${money(loyaltyDiscount)}` : `1 point = ${currency} ${money(loyaltyPointValue)}`}
            sx={{ mb: 1.5, bgcolor: 'background.paper' }}
          />
        )}
        <Stack spacing={0.4} sx={{ mb: 1.5 }}>
          {(discountTotal > 0 || taxTotal > 0 || loyaltyDiscount > 0) && (
            <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">Subtotal</Typography>
              <Typography variant="body2">{money(subtotal)}</Typography>
            </Stack>
          )}
          {discountTotal > 0 && (
            <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">Discount</Typography>
              <Typography variant="body2" color="success.main">−{money(discountTotal)}</Typography>
            </Stack>
          )}
          {taxTotal > 0 && (
            <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">Tax</Typography>
              <Typography variant="body2">{money(taxTotal)}</Typography>
            </Stack>
          )}
          {loyaltyDiscount > 0 && (
            <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">Loyalty reward</Typography>
              <Typography variant="body2" color="success.main">−{money(loyaltyDiscount)}</Typography>
            </Stack>
          )}
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Typography sx={{ fontWeight: 700 }}>
              Total{itemCount > 0 ? ` · ${itemCount} item${itemCount === 1 ? '' : 's'}` : ''}
            </Typography>
            <Typography sx={{ fontWeight: 850, fontSize: 24 }}>
              {currency} {money(amountDue)}
            </Typography>
          </Stack>
        </Stack>

        {paymentMethodsQuery.isSuccess && activeMethods.length === 0 && (
          <Alert severity="warning" sx={{ mb: 1.5 }}>
            No payment methods are set up. Ask the owner to add one in Settings.
          </Alert>
        )}

        <Button
          variant="contained"
          size="large"
          fullWidth
          disabled={!canPay}
          onClick={startCharge}
          sx={{ py: 1.6, fontSize: 18, fontWeight: 800, borderRadius: 2.5 }}
        >
          {cart.length === 0 ? 'Add items to charge' : needsRx ? 'Add prescription & charge' : `Charge ${currency} ${money(amountDue)}`}
        </Button>
        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
          <Button fullWidth color="inherit" startIcon={<PauseCircleOutlined />} disabled={cart.length === 0 || locked} loading={holdMutation.isPending} onClick={() => holdMutation.mutate()}>
            Hold
          </Button>
          <Button fullWidth color="inherit" startIcon={<DeleteOutlined />} disabled={cart.length === 0 || locked} onClick={clearSale}>
            Clear
          </Button>
        </Stack>
        {isDesktop && (
          <Typography variant="caption" color="text.disabled" sx={{ display: 'block', textAlign: 'center', mt: 0.5 }}>
            Shortcuts: F2 search · F4 charge · F6 hold
          </Typography>
        )}
      </Box>
    </Paper>
  )

  return (
    <Box sx={{ display: 'flex', gap: 2, height: { md: 'calc(100dvh - 112px)' }, minHeight: { md: 520 }, pb: { xs: 10, md: 0 } }}>
      {/* LEFT: find products */}
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <Stack direction="row" spacing={1} sx={{ mb: 1.5, alignItems: 'center' }}>
          <TextField
            inputRef={inputRef}
            fullWidth
            autoFocus
            placeholder={isPharmacy ? 'Search medicine (brand or generic) or scan…' : 'Search products or scan a barcode…'}
            value={query}
            disabled={locked}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <QrCodeScanner color={scanMutation.isPending ? 'primary' : 'action'} />
                  </InputAdornment>
                ),
                endAdornment: query ? (
                  <InputAdornment position="end">
                    <IconButton size="small" aria-label="Clear search" onClick={() => { setQuery(''); inputRef.current?.focus() }}>
                      <Close fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : null,
                sx: { bgcolor: 'background.paper', borderRadius: 3, fontSize: 16, height: 52 },
              },
            }}
          />
          <Badge badgeContent={heldSales.length} color="warning">
            <Button
              variant="outlined"
              onClick={(e) => setHeldAnchor(e.currentTarget)}
              disabled={heldSales.length === 0}
              startIcon={<PauseCircleOutlined />}
              sx={{ height: 52, whiteSpace: 'nowrap', bgcolor: 'background.paper', borderRadius: 3, minWidth: { xs: 52, sm: 'auto' }, '& .MuiButton-startIcon': { mr: { xs: 0, sm: 1 } } }}
            >
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                Held sales
              </Box>
            </Button>
          </Badge>
          <Button
            variant="outlined"
            color="inherit"
            onClick={() => setEndShiftOpen(true)}
            startIcon={<Logout />}
            sx={{ height: 52, whiteSpace: 'nowrap', bgcolor: 'background.paper', borderRadius: 3, borderColor: 'divider', minWidth: { xs: 52, sm: 'auto' }, '& .MuiButton-startIcon': { mr: { xs: 0, sm: 1 } } }}
          >
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
              End shift
            </Box>
          </Button>
        </Stack>

        {(categoriesQuery.data?.length ?? 0) > 0 && (
          <Stack direction="row" spacing={1} sx={{ mb: 1.5, overflowX: 'auto', pb: 0.5, flexShrink: 0, '&::-webkit-scrollbar': { height: 4 } }}>
            <Chip label="All" color={categoryId === null ? 'primary' : 'default'} variant={categoryId === null ? 'filled' : 'outlined'} onClick={() => setCategoryId(null)} sx={{ fontWeight: 700, bgcolor: categoryId === null ? undefined : 'background.paper' }} />
            {categoriesQuery.data!.map((c) => (
              <Chip
                key={c.id}
                label={c.name}
                color={categoryId === c.id ? 'primary' : 'default'}
                variant={categoryId === c.id ? 'filled' : 'outlined'}
                onClick={() => setCategoryId(categoryId === c.id ? null : c.id)}
                sx={{ fontWeight: 700, bgcolor: categoryId === c.id ? undefined : 'background.paper' }}
              />
            ))}
          </Stack>
        )}

        {scanError && (
          <Alert severity="warning" onClose={() => setScanError(null)} sx={{ mb: 1.5 }}>
            {scanError}
          </Alert>
        )}
        {locked && (
          <Alert severity="info" sx={{ mb: 1.5 }} action={<Button color="inherit" size="small" onClick={resetSale}>Cancel</Button>}>
            You are finishing a held sale. Items can't be changed — just take payment.
          </Alert>
        )}

        <Box sx={{ flexGrow: 1, overflowY: { md: 'auto' }, minHeight: 0, pr: { md: 0.5 } }}>
          {searchQuery.isLoading ? (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 1.25 }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} variant="rounded" height={140} sx={{ borderRadius: 3 }} />
              ))}
            </Box>
          ) : products.length === 0 ? (
            <Paper variant="outlined" sx={{ p: 5, textAlign: 'center', borderRadius: 3, borderStyle: 'dashed' }}>
              <Typography sx={{ fontWeight: 700 }}>{query ? `Nothing matches “${query}”` : 'No products to sell yet'}</Typography>
              <Typography variant="body2" color="text.secondary">
                {query ? 'Try another name, or press Enter to look it up as a barcode.' : 'Add products under “Products & Stock” first.'}
              </Typography>
            </Paper>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(auto-fill, minmax(150px, 1fr))' }, gap: 1.25, pb: 1 }}>
              {products.map((product) => (
                <ProductTile
                  key={product.id}
                  product={product}
                  currency={currency}
                  disabled={locked}
                  inCart={cartQty(product.id)}
                  onAdd={() => {
                    setScanError(null)
                    if (isWeighed(product)) setWeighFor({ product })
                    else addToCart(product)
                  }}
                />
              ))}
            </Box>
          )}
        </Box>
      </Box>

      {/* RIGHT: the sale (desktop column / mobile drawer) */}
      {isDesktop ? (
        <Box sx={{ width: { md: 360, lg: 400 }, flexShrink: 0, minHeight: 0 }}>{cartPanel}</Box>
      ) : (
        <>
          <Drawer anchor="bottom" open={cartOpen} onClose={() => setCartOpen(false)} slotProps={{ paper: { sx: { height: '92dvh', borderTopLeftRadius: 16, borderTopRightRadius: 16 } } }}>
            {cartPanel}
          </Drawer>
          <Box sx={{ position: 'fixed', left: 0, right: 0, bottom: 0, p: 1.25, bgcolor: 'background.paper', borderTop: '1px solid', borderColor: 'divider', zIndex: (t) => t.zIndex.appBar, boxShadow: '0 -4px 16px rgba(0,0,0,0.06)' }}>
            <Button
              variant="contained"
              size="large"
              fullWidth
              onClick={() => setCartOpen(true)}
              endIcon={<KeyboardArrowUp />}
              sx={{ py: 1.4, fontSize: 16, fontWeight: 800, borderRadius: 2.5, justifyContent: 'space-between' }}
            >
              <span>{cart.length === 0 ? 'Current sale · empty' : `View sale · ${itemCount} item${itemCount === 1 ? '' : 's'}`}</span>
              <span>{currency} {money(amountDue)}</span>
            </Button>
          </Box>
        </>
      )}

      <Menu anchorEl={heldAnchor} open={!!heldAnchor} onClose={() => setHeldAnchor(null)} slotProps={{ paper: { sx: { minWidth: 280 } } }}>
        <Typography variant="overline" sx={{ px: 2, color: 'text.secondary' }}>
          Tap a sale to finish it
        </Typography>
        {heldSales.map((s) => (
          <MenuItem key={s.id} onClick={() => resumeHeldSale(s)}>
            <ListItemText
              primary={`${s.customer_name || 'Walk-in customer'} · ${currency} ${money(Number(s.grand_total))}`}
              secondary={`${s.items?.length ?? 0} product(s) · held at ${new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
            />
          </MenuItem>
        ))}
      </Menu>

      {paymentOpen && (
        <PaymentDialog
          open
          grandTotal={amountDue}
          currency={currency}
          paymentMethods={activeMethods}
          submitting={saleMutation.isPending}
          creditAllowed={canCredit && !!selectedCustomer}
          customerName={selectedCustomer?.name}
          availableCredit={Math.max(0, Number(selectedCustomer?.credit_limit ?? 0) - Number(selectedCustomer?.outstanding_balance ?? 0))}
          onClose={() => setPaymentOpen(false)}
          onConfirm={(payments) => saleMutation.mutate(payments)}
        />
      )}

      <CustomerPickerDialog
        open={customerOpen}
        onClose={() => {
          setCustomerOpen(false)
          inputRef.current?.focus()
        }}
        onSelect={(customer) => {
          setSelectedCustomer(customer)
          setRedeemPoints(0)
        }}
      />

      <EndShiftDialog open={endShiftOpen} shiftId={shiftId} onClose={() => setEndShiftOpen(false)} />

      <WeighDialog
        product={weighFor?.product ?? null}
        initialGrams={weighFor?.grams}
        currency={currency}
        // Editing a line can use all stock; adding more must fit beside what's already in the cart.
        maxGrams={weighFor ? sellableStock(weighFor.product) - (weighFor.grams === undefined ? cartQty(weighFor.product.id) : 0) : 0}
        onClose={() => setWeighFor(null)}
        onSave={(grams) => {
          const target = weighFor!
          if (target.grams !== undefined) updateQuantity(target.product.id, grams)
          else addToCart(target.product, grams)
          setWeighFor(null)
          setTimeout(() => inputRef.current?.focus(), 50)
        }}
      />

      {isPharmacy && (
        <PrescriptionDialog
          open={rxOpen}
          rxMedicines={rxMedicines}
          initial={prescription}
          suggestion={selectedCustomer ? { patient_name: selectedCustomer.name, patient_phone: selectedCustomer.phone } : undefined}
          onClose={() => {
            setRxOpen(false)
            setPayAfterRx(false)
          }}
          onSave={(rx) => {
            setPrescription(rx)
            setRxOpen(false)
            if (payAfterRx) setPaymentOpen(true)
            setPayAfterRx(false)
          }}
        />
      )}
      {isPharmacy && (
        <DosageDialog
          open={!!dosageFor}
          medicine={dosageFor ? `${dosageFor.product.name}${medicineSubtitle(dosageFor.product) ? ` · ${medicineSubtitle(dosageFor.product)}` : ''}` : ''}
          initial={dosageFor?.dosage ?? ''}
          onClose={() => setDosageFor(null)}
          onSave={(dosage) => {
            const id = dosageFor?.product.id
            setCart((prev) => prev.map((l) => (l.product.id === id ? { ...l, dosage: dosage || undefined } : l)))
            setDosageFor(null)
          }}
        />
      )}

      {completedSale && (
        <ReceiptDialog
          sale={completedSale}
          onClose={() => {
            setCompletedSale(null)
            setTimeout(() => inputRef.current?.focus(), 50)
          }}
          onFiscalized={setCompletedSale}
        />
      )}
    </Box>
  )
}

export function PosCheckoutPage() {
  return <OpenShiftGate>{(branchId, shiftId) => <CheckoutScreen branchId={branchId} shiftId={shiftId} />}</OpenShiftGate>
}
