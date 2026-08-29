import { Add, Delete } from '@mui/icons-material'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useState } from 'react'
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
  onClose: () => void
  onConfirm: (payments: PaymentLine[]) => void
}

export function PaymentDialog({ open, grandTotal, currency, paymentMethods, submitting, onClose, onConfirm }: Props) {
  const cashMethod = paymentMethods.find((m) => m.type === 'cash')
  const [lines, setLines] = useState<PaymentLine[]>([
    { payment_method_id: cashMethod?.id ?? paymentMethods[0]?.id ?? 0, amount: grandTotal },
  ])

  const totalPaid = lines.reduce((sum, l) => sum + (l.amount || 0), 0)
  const balance = Math.round((totalPaid - grandTotal) * 100) / 100
  const isCashOnly = lines.length === 1 && paymentMethods.find((m) => m.id === lines[0].payment_method_id)?.type === 'cash'

  function updateLine(index: number, patch: Partial<PaymentLine>) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)))
  }

  function addLine() {
    setLines((prev) => [...prev, { payment_method_id: paymentMethods[0]?.id ?? 0, amount: 0 }])
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Payment</DialogTitle>
      <DialogContent>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 2 }}>
          {currency} {grandTotal.toLocaleString()}
        </Typography>

        <Stack spacing={1.5}>
          {lines.map((line, i) => (
            <Stack direction="row" spacing={1} key={i} sx={{ alignItems: 'center' }}>
              <TextField
                select
                label="Method"
                size="small"
                value={line.payment_method_id}
                onChange={(e) => updateLine(i, { payment_method_id: Number(e.target.value) })}
                sx={{ minWidth: 140 }}
              >
                {paymentMethods.map((m) => (
                  <MenuItem key={m.id} value={m.id}>
                    {m.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Amount"
                type="number"
                size="small"
                fullWidth
                value={line.amount}
                onChange={(e) => updateLine(i, { amount: Number(e.target.value) })}
              />
              {lines.length > 1 && (
                <IconButton size="small" onClick={() => removeLine(i)}>
                  <Delete fontSize="small" />
                </IconButton>
              )}
            </Stack>
          ))}
        </Stack>

        <Button startIcon={<Add />} size="small" onClick={addLine} sx={{ mt: 1.5 }}>
          Split payment
        </Button>

        <Box sx={{ mt: 2, p: 1.5, bgcolor: 'grey.50', borderRadius: 2 }}>
          {balance >= 0 ? (
            <Typography variant="body2" sx={{ fontWeight: 700 }} color={isCashOnly ? 'success.main' : 'text.primary'}>
              Change due: {currency} {balance.toLocaleString()}
            </Typography>
          ) : (
            <Alert severity="warning" sx={{ py: 0 }}>
              Short by {currency} {Math.abs(balance).toLocaleString()}
            </Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={balance < 0 || submitting}
          onClick={() => onConfirm(lines.filter((l) => l.amount > 0))}
          loading={submitting}
        >
          Complete sale
        </Button>
      </DialogActions>
    </Dialog>
  )
}
