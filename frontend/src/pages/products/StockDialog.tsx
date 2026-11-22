import { ArrowForward } from '@mui/icons-material'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { expiryStatus, pharmacyApi } from '../../api/endpoints/pharmacy'
import { usePlatform } from '../../hooks/usePlatform'
import { formatQty, isWeighed, kgToGrams } from '../../utils/quantity'
import { useEffect, useState } from 'react'
import { inventoryApi, type AdjustStockPayload } from '../../api/endpoints/inventory'
import { useAuthStore } from '../../stores/authStore'
import type { Product } from '../../types'

export type StockAction = 'add' | 'remove' | 'count'

const REMOVE_REASONS = [
  { value: 'damaged', label: 'Damaged' },
  { value: 'expired', label: 'Expired' },
  { value: 'lost', label: 'Lost' },
  { value: 'stolen', label: 'Stolen' },
] as const

/** Butchery wording for the same stock-removal types. */
const BUTCHERY_REMOVE_REASONS = [
  { value: 'expired', label: 'Spoiled' },
  { value: 'damaged', label: 'Trim & bone' },
  { value: 'lost', label: 'Lost' },
  { value: 'stolen', label: 'Stolen' },
] as const

const COPY: Record<StockAction, { title: string; field: string; help: string; button: string }> = {
  add: {
    title: 'Add stock',
    field: 'How many did you receive?',
    help: 'Enter the number of items that just arrived.',
    button: 'Add to stock',
  },
  remove: {
    title: 'Remove stock',
    field: 'How many to remove?',
    help: 'For items that can no longer be sold.',
    button: 'Remove from stock',
  },
  count: {
    title: 'Fix stock count',
    field: 'How many are on the shelf right now?',
    help: 'Count the items you physically have. We will correct the number for you.',
    button: 'Save count',
  },
}

interface Props {
  open: boolean
  action: StockAction
  product: Product | null
  branchId: number | null
  onClose: () => void
}

export function StockDialog({ open, action, product, branchId, onClose }: Props) {
  const queryClient = useQueryClient()
  const currency = useAuthStore((s) => s.user?.business?.currency ?? '')
  const [quantity, setQuantity] = useState('')
  const [unitCost, setUnitCost] = useState('')
  const [reason, setReason] = useState<(typeof REMOVE_REASONS)[number]['value']>('damaged')
  const { isPharmacy, isButchery } = usePlatform()
  const weighed = isWeighed(product)
  const reasons = isButchery ? BUTCHERY_REMOVE_REASONS : REMOVE_REASONS
  const [batchNumber, setBatchNumber] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [batchId, setBatchId] = useState<number | ''>('')
  const today = new Date().toISOString().slice(0, 10)
  const batchesQuery = useQuery({
    queryKey: ['pharmacy', 'batches', product?.id, branchId],
    queryFn: () => pharmacyApi.productBatches(product!.id, branchId ?? undefined),
    enabled: open && isPharmacy && action === 'remove' && !!product,
  })

  useEffect(() => {
    if (open) {
      setQuantity('')
      setBatchNumber('')
      setExpiryDate('')
      setBatchId('')
      setReason((product?.expired_stock ?? 0) > 0 || isButchery ? 'expired' : 'damaged')
      setUnitCost(product ? String(Number(product.cost_price)) : '')
    }
  }, [open, product, isButchery])

  const current = product?.available_stock ?? 0
  // Weighed products are typed in kg and stored in grams.
  const qty = weighed ? (kgToGrams(quantity) ?? NaN) : Math.floor(Number(quantity))
  const show = (n: number) => formatQty(n, weighed)
  const hasQty = quantity !== '' && Number.isFinite(qty) && qty >= 0
  const after = !hasQty ? null : action === 'add' ? current + qty : action === 'remove' ? current - qty : qty
  const copy = COPY[action]

  // Medicines: arriving stock must name its batch and a future expiry date.
  const needsBatch = isPharmacy && (action === 'add' || (action === 'count' && hasQty && qty > current))
  const batchInvalid = needsBatch && (batchNumber.trim() === '' || expiryDate === '' || expiryDate < today)
  const chosenBatch = batchesQuery.data?.find((b) => b.id === batchId)

  const invalid =
    batchInvalid ||
    (action === 'remove' && !!chosenBatch && qty > chosenBatch.quantity_remaining) ||
    !hasQty ||
    !branchId ||
    (action !== 'count' && qty <= 0) ||
    (action === 'remove' && qty > current) ||
    (action === 'count' && qty === current)

  const mutation = useMutation({
    mutationFn: () => {
      const payload: AdjustStockPayload =
        action === 'add'
          ? {
              branch_id: branchId!,
              type: 'purchase',
              quantity_change: qty,
              reason: 'Stock received',
              ...(isPharmacy ? { batch_number: batchNumber.trim(), expiry_date: expiryDate } : {}),
              ...(unitCost !== '' && Number(unitCost) !== Number(product!.cost_price) ? { unit_cost: Number(unitCost) } : {}),
            }
          : action === 'remove'
            ? { branch_id: branchId!, type: reason, quantity_change: -qty, reason: reasons.find((r) => r.value === reason)?.label, ...(batchId ? { batch_id: batchId } : {}) }
            : { branch_id: branchId!, type: 'adjustment', counted_quantity: qty, reason: 'Stock count', ...(needsBatch ? { batch_number: batchNumber.trim(), expiry_date: expiryDate } : {}) }
      return inventoryApi.adjust(product!.id, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      queryClient.invalidateQueries({ queryKey: ['stock-movements', product?.id] })
      queryClient.invalidateQueries({ queryKey: ['pharmacy'] })
      onClose()
    },
    meta: { successMessage: action === 'add' ? 'Stock added.' : action === 'remove' ? 'Stock removed.' : 'Stock count updated.' },
  })

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 800, pb: 0.5 }}>{isPharmacy && action === 'add' ? 'Receive stock' : copy.title}</DialogTitle>
      <DialogContent>
        <Typography variant="body1" sx={{ fontWeight: 600, mb: 2 }}>
          {product?.name}
        </Typography>

        <Stack spacing={2.5}>
          {action === 'remove' && (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Why are you removing it?
              </Typography>
              <ToggleButtonGroup
                exclusive
                fullWidth
                size="small"
                color="error"
                value={reason}
                onChange={(_, v) => v && setReason(v)}
              >
                {reasons.map((r) => (
                  <ToggleButton key={r.value} value={r.value} sx={{ textTransform: 'none', fontWeight: 600 }}>
                    {r.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
          )}

          <TextField
            label={weighed ? copy.field.replace('How many', 'How many kg').replace('How many kg are on the shelf right now?', 'How many kg are there right now?') : copy.field}
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            helperText={action === 'remove' && hasQty && qty > current ? `You only have ${show(current)} in stock.` : copy.help}
            error={action === 'remove' && hasQty && qty > current}
            autoFocus
            fullWidth
            slotProps={{ htmlInput: { min: 0, step: weighed ? 0.001 : 1, inputMode: weighed ? 'decimal' : 'numeric' }, input: weighed ? { endAdornment: <InputAdornment position="end">kg</InputAdornment> } : undefined }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !invalid) mutation.mutate()
            }}
          />


          {needsBatch && (
            <Stack direction="row" spacing={1.5}>
              <TextField label="Batch number" required value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} helperText="On the pack (Lot)" fullWidth />
              <TextField
                label="Expiry date"
                type="date"
                required
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                error={expiryDate !== '' && expiryDate < today}
                helperText={expiryDate !== '' && expiryDate < today ? 'Already expired' : 'On the pack (EXP)'}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: today } }}
                fullWidth
              />
            </Stack>
          )}

          {isPharmacy && action === 'remove' && (batchesQuery.data?.length ?? 0) > 0 && (
            <TextField select label="From which batch?" value={batchId} onChange={(e) => setBatchId(e.target.value === '' ? '' : Number(e.target.value))} fullWidth
              helperText={batchId === '' ? (reason === 'expired' ? 'Automatic: expired batches first.' : 'Automatic: nearest expiry first.') : undefined}>
              <MenuItem value="">Choose automatically</MenuItem>
              {batchesQuery.data!.map((b) => (
                <MenuItem key={b.id} value={b.id}>
                  Batch {b.batch_number} · {expiryStatus(b.expiry_date).label} · {b.quantity_remaining} left
                </MenuItem>
              ))}
            </TextField>
          )}

          {action === 'add' && (
            <TextField
              label={weighed ? 'Buying price per kg' : 'Buying price per item'}
              type="number"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              helperText="Change this only if the supplier's price changed."
              fullWidth
              slotProps={{ input: { startAdornment: <InputAdornment position="start">{currency}</InputAdornment> }, htmlInput: { min: 0 } }}
            />
          )}

          <Stack
            direction="row"
            spacing={2}
            sx={{ alignItems: 'center', justifyContent: 'center', py: 1.5, borderRadius: 2, bgcolor: 'grey.50', border: '1px solid', borderColor: 'divider' }}
          >
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                {action === 'count' ? 'System says' : 'In stock now'}
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>
                {show(current)}
              </Typography>
            </Box>
            <ArrowForward color="action" />
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                After
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: after === null ? 'text.disabled' : after < current ? 'error.main' : 'success.main' }}>
                {after === null ? '—' : show(after)}
              </Typography>
            </Box>
          </Stack>

          {action === 'count' && hasQty && qty !== current && (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
              {qty < current ? `${show(current - qty)} missing will be removed from stock.` : `${show(qty - current)} extra will be added to stock.`}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} size="large">
          Cancel
        </Button>
        <Button
          variant="contained"
          size="large"
          color={action === 'remove' ? 'error' : 'primary'}
          disabled={invalid}
          loading={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {copy.button}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
