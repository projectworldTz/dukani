import { AddRounded, ContentCutRounded, DeleteOutlined } from '@mui/icons-material'
import { Alert, Box, Button, Chip, IconButton, InputAdornment, LinearProgress, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { butcheryApi, type CarcassBreakdown } from '../../api/endpoints/butchery'
import { productsApi } from '../../api/endpoints/products'
import { useActiveBranch } from '../../hooks/useActiveBranch'
import { useAuthStore } from '../../stores/authStore'
import { gramsToKg, isWeighed } from '../../utils/quantity'

interface CutLine {
  key: number
  productId: number | ''
  kg: string
}

let nextKey = 1
const blankLine = (): CutLine => ({ key: nextKey++, productId: '', kg: '' })

/**
 * Cut up a carcass: weigh the whole animal, weigh each cut, and Dukani adds every cut to
 * stock costed at the carcass price spread over the usable meat — bone and trim loss
 * included — and shows the yield.
 */
export function CarcassPage() {
  const queryClient = useQueryClient()
  const currency = useAuthStore((s) => s.user?.business?.currency ?? '')
  const { branchId } = useActiveBranch()
  const [description, setDescription] = useState('')
  const [carcassKg, setCarcassKg] = useState('')
  const [totalCost, setTotalCost] = useState('')
  const [lines, setLines] = useState<CutLine[]>([blankLine(), blankLine(), blankLine()])
  const [result, setResult] = useState<CarcassBreakdown | null>(null)

  const productsQuery = useQuery({
    queryKey: ['products', 'weighed', branchId],
    queryFn: () => productsApi.list({ status: 'active', per_page: 100 }),
    select: (d) => d.data.filter(isWeighed),
  })
  const historyQuery = useQuery({ queryKey: ['butchery', 'breakdowns'], queryFn: butcheryApi.breakdowns })

  const carcass = Number(carcassKg) || 0
  const filled = lines.filter((l) => l.productId !== '' && Number(l.kg) > 0)
  const yieldKg = filled.reduce((sum, l) => sum + Number(l.kg), 0)
  const yieldPct = carcass > 0 ? (yieldKg / carcass) * 100 : 0
  const costPerKg = yieldKg > 0 ? Number(totalCost || 0) / yieldKg : 0
  const over = carcass > 0 && yieldKg > carcass
  const duplicates = new Set(filled.map((l) => l.productId)).size !== filled.length
  const valid = description.trim() !== '' && carcass > 0 && totalCost !== '' && filled.length > 0 && !over && !duplicates && !!branchId

  const mutation = useMutation({
    mutationFn: () =>
      butcheryApi.createBreakdown({
        branch_id: branchId!,
        description: description.trim(),
        carcass_weight_kg: carcass,
        total_cost: Number(totalCost),
        lines: filled.map((l) => ({ product_id: Number(l.productId), weight_kg: Number(l.kg) })),
      }),
    onSuccess: (r) => {
      setResult(r)
      setDescription('')
      setCarcassKg('')
      setTotalCost('')
      setLines([blankLine(), blankLine(), blankLine()])
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['butchery'] })
    },
    meta: { successMessage: 'Cuts added to stock.' },
  })

  const money = (n: number) => `${currency} ${Math.round(n).toLocaleString()}`
  const updateLine = (key: number, patch: Partial<CutLine>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 800 }}>
        Cut Carcass
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        Weigh the whole animal, then each cut. The cuts go into stock, priced at what the meat really cost you after bone and trim.
      </Typography>

      {result && (
        <Alert severity="success" onClose={() => setResult(null)} sx={{ mb: 2 }}>
          <strong>{result.description}</strong>: {gramsToKg(result.yield_weight_g)} kg of cuts added ({result.yield_percent}% yield, {result.loss_kg} kg bone &amp; trim). Cost {money(Number(result.cost_per_kg))} per kg.
        </Alert>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.4fr) minmax(0, 1fr)' }, gap: 2, alignItems: 'start' }}>
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: '12px' }}>
          <Typography sx={{ fontWeight: 800, mb: 1.5 }}>1. The whole carcass</Typography>
          <Stack spacing={2}>
            <TextField label="What is it?" placeholder="e.g. Goat from Pugu market" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="Carcass weight" type="number" value={carcassKg} onChange={(e) => setCarcassKg(e.target.value)} fullWidth slotProps={{ input: { endAdornment: <InputAdornment position="end">kg</InputAdornment> }, htmlInput: { min: 0, step: 0.1, inputMode: 'decimal' } }} />
              <TextField label="What you paid" type="number" value={totalCost} onChange={(e) => setTotalCost(e.target.value)} fullWidth slotProps={{ input: { startAdornment: <InputAdornment position="start">{currency}</InputAdornment> }, htmlInput: { min: 0, inputMode: 'decimal' } }} />
            </Stack>
          </Stack>

          <Typography sx={{ fontWeight: 800, mt: 3, mb: 1.5 }}>2. Weight of each cut</Typography>
          {productsQuery.isSuccess && (productsQuery.data?.length ?? 0) === 0 && (
            <Alert severity="info" sx={{ mb: 1.5 }}>
              Add your cuts (e.g. “Goat leg”, “Goat ribs”) as products sold by weight first.
            </Alert>
          )}
          <Stack spacing={1.25}>
            {lines.map((l, i) => (
              <Stack key={l.key} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <TextField select label={`Cut ${i + 1}`} value={l.productId} onChange={(e) => updateLine(l.key, { productId: e.target.value === '' ? '' : Number(e.target.value) })} sx={{ flex: 2, minWidth: 0 }}>
                  <MenuItem value="">Choose a cut</MenuItem>
                  {(productsQuery.data ?? []).map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField label="Weight" type="number" value={l.kg} onChange={(e) => updateLine(l.key, { kg: e.target.value })} sx={{ flex: 1, minWidth: 0 }} slotProps={{ input: { endAdornment: <InputAdornment position="end">kg</InputAdornment> }, htmlInput: { min: 0, step: 0.1, inputMode: 'decimal' } }} />
                <IconButton aria-label="Remove cut" onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.key !== l.key) : ls))}>
                  <DeleteOutlined />
                </IconButton>
              </Stack>
            ))}
          </Stack>
          <Button startIcon={<AddRounded />} onClick={() => setLines((ls) => [...ls, blankLine()])} sx={{ mt: 1 }}>
            Add another cut
          </Button>
          {duplicates && <Alert severity="warning" sx={{ mt: 1.5 }}>Each cut can appear only once — add the weights together.</Alert>}
        </Paper>

        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: '12px', position: { lg: 'sticky' }, top: { lg: 96 } }}>
          <Typography sx={{ fontWeight: 800, mb: 1.5 }}>3. Check and save</Typography>
          <Stack spacing={1}>
            {[
              ['Carcass', carcass > 0 ? `${carcass.toLocaleString()} kg` : '—'],
              ['Cuts (usable meat)', `${yieldKg.toLocaleString(undefined, { maximumFractionDigits: 3 })} kg`],
              ['Bone & trim loss', carcass > 0 ? `${Math.max(0, carcass - yieldKg).toLocaleString(undefined, { maximumFractionDigits: 3 })} kg` : '—'],
            ].map(([label, value]) => (
              <Stack key={label} direction="row" sx={{ justifyContent: 'space-between' }}>
                <Typography color="text.secondary">{label}</Typography>
                <Typography sx={{ fontWeight: 700 }}>{value}</Typography>
              </Stack>
            ))}
          </Stack>
          <Box sx={{ mt: 2 }}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>Yield</Typography>
              <Typography variant="body2" sx={{ fontWeight: 800, color: over ? 'error.main' : 'text.primary' }}>{carcass > 0 ? `${yieldPct.toFixed(1)}%` : '—'}</Typography>
            </Stack>
            <LinearProgress variant="determinate" value={Math.min(100, yieldPct)} color={over ? 'error' : 'primary'} sx={{ height: 10, borderRadius: 5 }} />
          </Box>
          <Box sx={{ mt: 2, p: 2, borderRadius: 2, bgcolor: '#FFF1F2', border: '1px solid', borderColor: '#FECDD3' }}>
            <Typography variant="body2" color="text.secondary">
              Real cost per kg of meat
            </Typography>
            <Typography sx={{ fontWeight: 800, fontSize: 26, color: 'primary.main' }}>{yieldKg > 0 && totalCost ? money(costPerKg) : '—'}</Typography>
            <Typography variant="caption" color="text.secondary">
              Set your selling prices above this on the Price Board.
            </Typography>
          </Box>
          {over && <Alert severity="error" sx={{ mt: 1.5 }}>The cuts weigh more than the carcass. Check the weights.</Alert>}
          <Button variant="contained" size="large" fullWidth startIcon={<ContentCutRounded />} disabled={!valid} loading={mutation.isPending} onClick={() => mutation.mutate()} sx={{ mt: 2, py: 1.25 }}>
            Add cuts to stock
          </Button>
        </Paper>
      </Box>

      {(historyQuery.data?.data?.length ?? 0) > 0 && (
        <Box sx={{ mt: 3 }}>
          <Typography sx={{ fontWeight: 800, mb: 1 }}>Recent carcasses</Typography>
          <Stack spacing={1}>
            {historyQuery.data!.data.slice(0, 8).map((b) => (
              <Paper key={b.id} variant="outlined" sx={{ p: 1.75, borderRadius: '12px' }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ justifyContent: 'space-between', gap: 1 }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700 }}>{b.description}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(b.created_at).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      {b.creator ? ` · ${b.creator.name}` : ''} · {b.lines.map((l) => `${l.name} ${gramsToKg(l.weight_g)} kg`).join(', ')}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexShrink: 0 }}>
                    <Chip size="small" label={`${Math.round((b.yield_weight_g / b.carcass_weight_g) * 100)}% yield`} />
                    <Chip size="small" color="primary" label={`${money(Number(b.cost_per_kg))}/kg`} />
                  </Stack>
                </Stack>
              </Paper>
            ))}
          </Stack>
        </Box>
      )}
    </Box>
  )
}
