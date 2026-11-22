import { ScaleRounded } from '@mui/icons-material'
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, InputAdornment, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { useEffect, useRef, useState } from 'react'
import type { Product } from '../../types'
import { GRAMS_PER_KG, gramsToKg, kgToGrams } from '../../utils/quantity'
import { money } from './posUtils'

interface Props {
  product: Product | null
  /** Grams already on the sale line when editing it. */
  initialGrams?: number
  /** Most grams that can be sold (stock on hand). */
  maxGrams: number
  currency: string
  onClose: () => void
  onSave: (grams: number) => void
}

type Mode = 'weight' | 'amount'

const QUICK_KG = [0.25, 0.5, 1, 2]

/**
 * Weigh an item at the counter: type the scale reading in kg, tap a common weight, or
 * switch to "By amount" when the customer asks for e.g. "TZS 5,000 worth".
 */
export function WeighDialog({ product, initialGrams, maxGrams, currency, onClose, onSave }: Props) {
  const [mode, setMode] = useState<Mode>('weight')
  const [value, setValue] = useState('')
  const pricePerKg = Number(product?.selling_price ?? 0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (product) {
      setMode('weight')
      setValue(initialGrams ? gramsToKg(initialGrams).replace(/,/g, '') : '')
    }
  }, [product, initialGrams])

  const grams =
    mode === 'weight'
      ? kgToGrams(value)
      : value !== '' && pricePerKg > 0 && Number(value) >= 0
        ? Math.round((Number(value) / pricePerKg) * GRAMS_PER_KG)
        : null
  const price = grams !== null ? Math.round(((pricePerKg * grams) / GRAMS_PER_KG) * 100) / 100 : null
  const tooMuch = grams !== null && grams > maxGrams
  const valid = grams !== null && grams > 0 && !tooMuch

  function save() {
    if (valid) onSave(grams!)
  }

  return (
    <Dialog
      open={!!product}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      // The scale reading is typed straight away — make sure the field has focus once the dialog is in.
      slotProps={{ transition: { onEntered: () => inputRef.current?.focus() } }}
    >
      <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
        <ScaleRounded color="primary" /> {product?.name}
      </DialogTitle>
      <DialogContent>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          {currency} {money(pricePerKg)} per kg · {gramsToKg(maxGrams)} kg in stock
        </Typography>

        <ToggleButtonGroup
          exclusive
          fullWidth
          size="small"
          value={mode}
          onChange={(_, v: Mode | null) => {
            if (!v) return
            setMode(v)
            setValue('')
            setTimeout(() => inputRef.current?.focus(), 0)
          }}
          sx={{ mb: 2, '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 700 } }}
        >
          <ToggleButton value="weight">By weight (kg)</ToggleButton>
          <ToggleButton value="amount">By amount ({currency})</ToggleButton>
        </ToggleButtonGroup>

        <TextField
          autoFocus
          inputRef={inputRef}
          fullWidth
          type="number"
          label={mode === 'weight' ? 'Weight on the scale' : 'Customer wants to spend'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              save()
            }
          }}
          error={tooMuch}
          helperText={tooMuch ? `Only ${gramsToKg(maxGrams)} kg in stock.` : mode === 'amount' ? 'We work out the weight to cut.' : undefined}
          slotProps={{
            htmlInput: { min: 0, step: mode === 'weight' ? 0.001 : 100, inputMode: 'decimal' },
            input: {
              ...(mode === 'weight'
                ? { endAdornment: <InputAdornment position="end">kg</InputAdornment> }
                : { startAdornment: <InputAdornment position="start">{currency}</InputAdornment> }),
              sx: { fontSize: 26, fontWeight: 800 },
            },
          }}
        />

        {mode === 'weight' && (
          <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
            {QUICK_KG.map((kg) => (
              <Button key={kg} variant={kgToGrams(value) === kg * GRAMS_PER_KG ? 'contained' : 'outlined'} onClick={() => { setValue(String(kg)); inputRef.current?.focus() }} sx={{ flex: 1, fontWeight: 700 }}>
                {kg === 0.25 ? '¼' : kg === 0.5 ? '½' : kg} kg
              </Button>
            ))}
          </Stack>
        )}

        <Box sx={{ mt: 2.5, p: 2, borderRadius: 2.5, bgcolor: '#FFF1F2', border: '1px solid', borderColor: '#FECDD3', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1 }}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Weight
            </Typography>
            <Typography sx={{ fontWeight: 800, fontSize: 22 }}>{grams !== null ? `${gramsToKg(grams)} kg` : '—'}</Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="caption" color="text.secondary">
              Price
            </Typography>
            <Typography sx={{ fontWeight: 800, fontSize: 22, color: 'primary.main' }}>{price !== null ? `${currency} ${money(price)}` : '—'}</Typography>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} size="large">
          Cancel
        </Button>
        <Button variant="contained" size="large" disabled={!valid} onClick={save}>
          {initialGrams ? 'Update weight' : 'Add to sale'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
