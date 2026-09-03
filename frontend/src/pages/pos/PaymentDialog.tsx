import { Add, Delete } from '@mui/icons-material'
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { useMemo, useState } from 'react'
import type { PaymentMethod } from '../../types'

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

export function PaymentDialog({ open, grandTotal, currency, paymentMethods, submitting, creditAllowed = false, customerName, availableCredit = 0, onClose, onConfirm }: Props) {
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
    setLines((previous) => previous.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line))
  }

  function chooseMethod(methodId: number) {
    setLines([{ payment_method_id: methodId, amount: grandTotal }])
    setSplitPayment(false)
  }

  function addLine() {
    setSplitPayment(true)
    setLines((previous) => [...previous, { payment_method_id: paymentMethods[0]?.id ?? 0, amount: 0 }])
  }

  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>Take payment</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary">Amount due</Typography>
        <Typography variant="h3" sx={{ fontWeight: 850, mb: 2, fontSize: { xs: '2rem', sm: '3rem' }, overflowWrap: 'anywhere' }}>{currency} {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Typography>

        <Typography variant="subtitle2" sx={{ mb: 1 }}>How is the customer paying?</Typography>
        <Stack direction="row" sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
          {paymentMethods.map((method) => (
            <Button key={method.id} variant={!splitPayment && lines[0]?.payment_method_id === method.id ? 'contained' : 'outlined'} onClick={() => chooseMethod(method.id)} sx={{ minWidth: { xs: 'calc(50% - 8px)', sm: 110 }, flexGrow: { xs: 1, sm: 0 } }}>
              {method.name}
            </Button>
          ))}
        </Stack>

        <Stack spacing={1.5}>
          {lines.map((line, index) => {
            const method = paymentMethods.find((item) => item.id === line.payment_method_id)
            return (
              <Stack key={index} spacing={1}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { xs: 'stretch', sm: 'center' }, position: 'relative' }}>
                  {splitPayment && (
                    <TextField select label="Method" size="small" value={line.payment_method_id} onChange={(event) => updateLine(index, { payment_method_id: Number(event.target.value), reference: '' })} sx={{ minWidth: { sm: 145 } }}>
                      {paymentMethods.map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}
                    </TextField>
                  )}
                  <TextField label={method?.type === 'cash' ? 'Cash received' : 'Amount'} type="number" size="small" autoFocus={index === 0} fullWidth value={line.amount || ''} onChange={(event) => updateLine(index, { amount: Math.max(0, Number(event.target.value)) })} slotProps={{ htmlInput: { min: 0, step: '0.01' } }} />
                  {lines.length > 1 && <IconButton aria-label="Remove payment" onClick={() => setLines((previous) => previous.filter((_, i) => i !== index))} sx={{ alignSelf: { xs: 'flex-end', sm: 'center' } }}><Delete /></IconButton>}
                </Stack>
                {method && method.type !== 'cash' && (
                  <TextField label={`${method.name} transaction/reference (optional)`} size="small" value={line.reference ?? ''} onChange={(event) => updateLine(index, { reference: event.target.value })} />
                )}
              </Stack>
            )
          })}
        </Stack>

        {!splitPayment && lines[0] && selectedTypes[0] === 'cash' && (
          <Stack direction="row" sx={{ mt: 1.5, flexWrap: 'wrap', gap: 1 }}>
            <Button size="small" variant="outlined" onClick={() => updateLine(0, { amount: grandTotal })}>Exact amount</Button>
            {[5000, 10000, 20000, 50000].filter((amount) => amount > grandTotal).slice(0, 3).map((amount) => (
              <Button key={amount} size="small" onClick={() => updateLine(0, { amount })}>{amount.toLocaleString()}</Button>
            ))}
          </Stack>
        )}

        {!splitPayment && paymentMethods.length > 1 && <Button startIcon={<Add />} size="small" onClick={addLine} sx={{ mt: 1.5 }}>Use split payment</Button>}

        <Box sx={{ mt: 2, p: 1.5, bgcolor: 'grey.50', borderRadius: 2 }}>
          {balance > 0 && !hasNonCashOverpayment && <Typography color="success.main" sx={{ fontWeight: 800 }}>Change due: {currency} {balance.toLocaleString()}</Typography>}
          {balance === 0 && <Typography color="success.main" sx={{ fontWeight: 700 }}>Payment matches the total.</Typography>}
          {shortfall > 0 && canUseCredit && <Alert severity="info">{currency} {shortfall.toLocaleString()} will be recorded on {customerName}'s account.</Alert>}
          {shortfall > 0 && !canUseCredit && <Alert severity="warning">Still due: {currency} {shortfall.toLocaleString()}. Collect the balance or select an eligible credit customer.</Alert>}
          {hasNonCashOverpayment && <Alert severity="warning">Card and mobile payments cannot exceed the amount due.</Alert>}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: { xs: 2, sm: 3 }, pb: 2, '& > button': { flex: { xs: '1 1 100%', sm: '0 0 auto' } } }}>
        <Button onClick={onClose} disabled={submitting}>Back to cart</Button>
        <Button variant="contained" size="large" disabled={!canComplete || submitting} onClick={() => onConfirm(lines.filter((line) => line.amount > 0))} loading={submitting}>Complete sale</Button>
      </DialogActions>
    </Dialog>
  )
}
