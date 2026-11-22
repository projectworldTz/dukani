import { AccountBalance, Add, CreditCard, Delete, Payments, PhoneAndroid } from '@mui/icons-material'
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Dialog,
  DialogActions,
  DialogContent,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import { useMemo, useState } from 'react'
import type { PaymentMethod } from '../../types'
import { money, quickCashAmounts } from './posUtils'

export interface PaymentLine {
  payment_method_id: number
  amount: number
  reference?: string
}

interface Props {
  open: boolean
  grandTotal: number
  currency: string
  paymentMethods: PaymentMethod[]
  submitting?: boolean
  creditAllowed?: boolean
  customerName?: string
  availableCredit?: number
  onClose: () => void
  onConfirm: (payments: PaymentLine[]) => void
}

function methodIcon(type: string) {
  if (type === 'cash') return <Payments />
  if (type === 'mobile_money') return <PhoneAndroid />
  if (type === 'card') return <CreditCard />
  return <AccountBalance />
}

export function PaymentDialog({ open, grandTotal, currency, paymentMethods, submitting, creditAllowed = false, customerName, availableCredit = 0, onClose, onConfirm }: Props) {
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))
  const cashMethod = paymentMethods.find((method) => method.type === 'cash')
  const defaultMethodId = cashMethod?.id ?? paymentMethods[0]?.id ?? 0
  const [lines, setLines] = useState<PaymentLine[]>([{ payment_method_id: defaultMethodId, amount: grandTotal }])
  const [splitPayment, setSplitPayment] = useState(false)

  const totalPaid = lines.reduce((sum, line) => sum + (line.amount || 0), 0)
  const balance = Math.round((totalPaid - grandTotal) * 100) / 100
  const shortfall = Math.max(0, -balance)
  const selectedTypes = useMemo(() => lines.map((line) => paymentMethods.find((method) => method.id === line.payment_method_id)?.type), [lines, paymentMethods])
  const cashCollected = lines.reduce((sum, line, index) => sum + (selectedTypes[index] === 'cash' ? line.amount : 0), 0)
  const hasNonCashOverpayment = balance > 0 && cashCollected < balance
  const canUseCredit = creditAllowed && shortfall > 0 && shortfall <= availableCredit
  const canComplete = (totalPaid > 0 || canUseCredit) && (balance >= 0 || canUseCredit) && !hasNonCashOverpayment

  function updateLine(index: number, patch: Partial<PaymentLine>) {
    setLines((previous) => previous.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)))
  }

  function chooseMethod(methodId: number) {
    setLines([{ payment_method_id: methodId, amount: grandTotal }])
    setSplitPayment(false)
  }

  function addLine() {
    setSplitPayment(true)
    setLines((previous) => [...previous, { payment_method_id: paymentMethods[0]?.id ?? 0, amount: Math.max(0, shortfall) }])
  }

  function complete() {
    if (canComplete && !submitting) onConfirm(lines.filter((line) => line.amount > 0))
  }

  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} maxWidth="sm" fullWidth fullScreen={fullScreen}>
      <Box sx={{ px: 3, pt: 3, pb: 2, bgcolor: 'primary.main', color: 'primary.contrastText' }}>
        <Typography variant="body2" sx={{ opacity: 0.85 }}>
          Amount to pay
        </Typography>
        <Typography sx={{ fontWeight: 850, fontSize: { xs: '2.2rem', sm: '2.8rem' }, lineHeight: 1.1, overflowWrap: 'anywhere' }}>
          {currency} {money(grandTotal)}
        </Typography>
      </Box>
      <DialogContent sx={{ pt: 2.5 }}>
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
          How is the customer paying?
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: `repeat(${Math.min(paymentMethods.length, 4)}, 1fr)` }, gap: 1, mb: 2.5 }}>
          {paymentMethods.map((method) => {
            const active = !splitPayment && lines[0]?.payment_method_id === method.id
            return (
              <ButtonBase
                key={method.id}
                onClick={() => chooseMethod(method.id)}
                aria-pressed={active}
                sx={{
                  flexDirection: 'column',
                  gap: 0.5,
                  py: 1.5,
                  borderRadius: 2.5,
                  border: '2px solid',
                  borderColor: active ? 'primary.main' : 'divider',
                  bgcolor: active ? 'rgba(22, 101, 52, 0.08)' : 'background.paper',
                  color: active ? 'primary.main' : 'text.primary',
                  fontWeight: 700,
                  fontSize: 14,
                  transition: 'all .15s',
                  '&:hover': { borderColor: 'primary.light' },
                }}
              >
                {methodIcon(method.type)}
                {method.name}
              </ButtonBase>
            )
          })}
        </Box>

        <Stack spacing={1.5}>
          {lines.map((line, index) => {
            const method = paymentMethods.find((item) => item.id === line.payment_method_id)
            return (
              <Stack key={index} spacing={1}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { xs: 'stretch', sm: 'center' } }}>
                  {splitPayment && (
                    <TextField select label="Method" size="small" value={line.payment_method_id} onChange={(event) => updateLine(index, { payment_method_id: Number(event.target.value), reference: '' })} sx={{ minWidth: { sm: 150 } }}>
                      {paymentMethods.map((item) => (
                        <MenuItem key={item.id} value={item.id}>
                          {item.name}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                  <TextField
                    label={method?.type === 'cash' ? 'Cash received' : 'Amount'}
                    type="number"
                    autoFocus={index === 0}
                    fullWidth
                    value={line.amount || ''}
                    onChange={(event) => updateLine(index, { amount: Math.max(0, Number(event.target.value)) })}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        complete()
                      }
                    }}
                    onFocus={(event) => event.target.select()}
                    slotProps={{
                      input: { startAdornment: <InputAdornment position="start">{currency}</InputAdornment>, sx: { fontSize: 20, fontWeight: 700 } },
                      htmlInput: { min: 0, step: '0.01', inputMode: 'decimal' },
                    }}
                  />
                  {lines.length > 1 && (
                    <IconButton aria-label="Remove payment" onClick={() => setLines((previous) => previous.filter((_, i) => i !== index))} sx={{ alignSelf: { xs: 'flex-end', sm: 'center' } }}>
                      <Delete />
                    </IconButton>
                  )}
                </Stack>
                {method && method.type !== 'cash' && (
                  <TextField label={`${method.name} transaction ID (optional)`} size="small" value={line.reference ?? ''} onChange={(event) => updateLine(index, { reference: event.target.value })} />
                )}
              </Stack>
            )
          })}
        </Stack>

        {!splitPayment && lines[0] && selectedTypes[0] === 'cash' && (
          <Box sx={{ mt: 1.5 }}>
            <Typography variant="caption" color="text.secondary">
              Customer gave:
            </Typography>
            <Stack direction="row" sx={{ mt: 0.5, flexWrap: 'wrap', gap: 1 }}>
              {quickCashAmounts(grandTotal).map((amount, i) => (
                <Button
                  key={amount}
                  variant={lines[0].amount === amount ? 'contained' : 'outlined'}
                  onClick={() => updateLine(0, { amount })}
                  sx={{ flex: { xs: '1 1 30%', sm: '0 0 auto' }, fontWeight: 700 }}
                >
                  {i === 0 ? 'Exact amount' : amount.toLocaleString()}
                </Button>
              ))}
            </Stack>
          </Box>
        )}

        {!splitPayment && paymentMethods.length > 1 && (
          <Button startIcon={<Add />} size="small" onClick={addLine} sx={{ mt: 1.5 }}>
            Use split payment
          </Button>
        )}

        <Box sx={{ mt: 2.5 }}>
          {balance > 0 && !hasNonCashOverpayment && (
            <Box sx={{ p: 2, borderRadius: 2.5, bgcolor: '#ECFDF5', border: '1px solid', borderColor: 'success.light', textAlign: 'center' }}>
              <Typography variant="body2" color="success.dark" sx={{ fontWeight: 600 }}>
                Give change
              </Typography>
              <Typography sx={{ fontWeight: 850, fontSize: '2rem', color: 'success.dark', lineHeight: 1.2 }}>
                {currency} {money(balance)}
              </Typography>
            </Box>
          )}
          {balance === 0 && (
            <Typography color="success.main" sx={{ fontWeight: 700, textAlign: 'center' }}>
              Payment matches the total — no change.
            </Typography>
          )}
          {shortfall > 0 && canUseCredit && (
            <Alert severity="info">
              {currency} {money(shortfall)} will be recorded on {customerName}'s account.
            </Alert>
          )}
          {shortfall > 0 && !canUseCredit && (
            <Alert severity="warning">
              Still to pay: {currency} {money(shortfall)}. Collect the rest{creditAllowed ? ` (credit available: ${currency} ${money(availableCredit)})` : ', or choose a saved customer to sell on credit'}.
            </Alert>
          )}
          {hasNonCashOverpayment && <Alert severity="warning">Card and mobile payments cannot be more than the amount to pay.</Alert>}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: { xs: 2, sm: 3 }, pb: 2.5, '& > button': { flex: { xs: '1 1 100%', sm: '0 0 auto' } } }}>
        <Button onClick={onClose} disabled={submitting} size="large">
          Back to sale
        </Button>
        <Button variant="contained" size="large" disabled={!canComplete || submitting} onClick={complete} loading={submitting} sx={{ px: 4, py: 1.25, fontSize: 16 }}>
          Complete sale
        </Button>
      </DialogActions>
    </Dialog>
  )
}
