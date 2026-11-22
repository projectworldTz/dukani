import { SaveRounded, Search, UndoRounded } from '@mui/icons-material'
import { Alert, Box, Button, Chip, InputAdornment, Paper, Skeleton, Stack, TextField, Typography } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { butcheryApi } from '../../api/endpoints/butchery'
import { productsApi } from '../../api/endpoints/products'
import { useActiveBranch } from '../../hooks/useActiveBranch'
import { useAuthStore } from '../../stores/authStore'
import { formatQty, isWeighed } from '../../utils/quantity'

type Draft = Record<number, { sell?: string; cost?: string }>

/**
 * Daily price board: meat prices move with the market, so every price per kg can be
 * changed on one screen and saved in one tap.
 */
export function PriceBoardPage() {
  const queryClient = useQueryClient()
  const currency = useAuthStore((s) => s.user?.business?.currency ?? '')
  const { branchId } = useActiveBranch()
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState<Draft>({})

  const query = useQuery({
    queryKey: ['products', 'price-board', branchId],
    queryFn: () => productsApi.list({ status: 'active', per_page: 100, branch_id: branchId ?? undefined }),
    enabled: !!branchId,
  })
  const products = useMemo(
    () => (query.data?.data ?? []).filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase())),
    [query.data, search],
  )

  const changes = Object.entries(draft)
    .map(([id, d]) => {
      const p = query.data?.data.find((x) => x.id === Number(id))
      if (!p) return null
      const sell = d.sell !== undefined && d.sell !== '' ? Number(d.sell) : Number(p.selling_price)
      const cost = d.cost !== undefined && d.cost !== '' ? Number(d.cost) : undefined
      const changed = sell !== Number(p.selling_price) || (cost !== undefined && cost !== Number(p.cost_price))
      return changed && sell >= 0 ? { product_id: p.id, selling_price: sell, ...(cost !== undefined ? { cost_price: cost } : {}) } : null
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  const mutation = useMutation({
    mutationFn: () => butcheryApi.updatePrices(changes),
    onSuccess: (r) => {
      setDraft({})
      queryClient.invalidateQueries({ queryKey: ['products'] })
      return r
    },
    meta: { successMessage: 'Prices updated — the till uses them now.' },
  })

  const set = (id: number, key: 'sell' | 'cost', value: string) => setDraft((d) => ({ ...d, [id]: { ...d[id], [key]: value } }))

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' }, gap: 1.5, mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            Price Board
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Today's prices. Change any price and press Save — the till updates straight away.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          {changes.length > 0 && (
            <Button startIcon={<UndoRounded />} onClick={() => setDraft({})}>
              Undo
            </Button>
          )}
          <Button variant="contained" size="large" startIcon={<SaveRounded />} disabled={changes.length === 0} loading={mutation.isPending} onClick={() => mutation.mutate()} sx={{ flexGrow: { xs: 1, sm: 0 } }}>
            Save {changes.length > 0 ? `${changes.length} change${changes.length === 1 ? '' : 's'}` : 'prices'}
          </Button>
        </Stack>
      </Stack>

      <TextField
        placeholder="Find a product…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        size="small"
        fullWidth
        sx={{ mb: 2, maxWidth: 420, bgcolor: 'background.paper' }}
        slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search /></InputAdornment> } }}
      />

      {query.isLoading && <Skeleton variant="rounded" height={240} />}
      {query.isSuccess && products.length === 0 && <Alert severity="info">No products yet. Add them under Products & Stock.</Alert>}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' }, gap: 1.5 }}>
        {products.map((p) => {
          const d = draft[p.id] ?? {}
          const sell = d.sell ?? String(Number(p.selling_price))
          const cost = d.cost ?? String(Number(p.cost_price))
          const changed = (d.sell !== undefined && Number(d.sell) !== Number(p.selling_price)) || (d.cost !== undefined && Number(d.cost) !== Number(p.cost_price))
          const margin = Number(sell) > 0 ? Math.round(((Number(sell) - Number(cost)) / Number(sell)) * 100) : null
          const unit = isWeighed(p) ? '/kg' : 'each'
          return (
            <Paper key={p.id} variant="outlined" sx={{ p: 2, borderRadius: '12px', borderColor: changed ? 'primary.main' : 'divider', borderWidth: changed ? 2 : 1 }}>
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5, gap: 1 }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 800 }} noWrap>
                    {p.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatQty(p.available_stock ?? 0, isWeighed(p))} in stock
                  </Typography>
                </Box>
                {margin !== null && <Chip size="small" label={`${margin}% margin`} color={margin < 0 ? 'error' : margin < 15 ? 'warning' : 'success'} variant="outlined" sx={{ fontWeight: 700 }} />}
              </Stack>
              <Stack direction="row" spacing={1.5}>
                <TextField
                  label={`Selling ${unit}`}
                  type="number"
                  value={sell}
                  onChange={(e) => set(p.id, 'sell', e.target.value)}
                  fullWidth
                  slotProps={{ input: { startAdornment: <InputAdornment position="start">{currency}</InputAdornment>, sx: { fontWeight: 800, fontSize: 18 } }, htmlInput: { min: 0, inputMode: 'decimal' } }}
                />
                <TextField
                  label={`Cost ${unit}`}
                  type="number"
                  value={cost}
                  onChange={(e) => set(p.id, 'cost', e.target.value)}
                  fullWidth
                  slotProps={{ input: { startAdornment: <InputAdornment position="start">{currency}</InputAdornment> }, htmlInput: { min: 0, inputMode: 'decimal' } }}
                />
              </Stack>
            </Paper>
          )
        })}
      </Box>
    </Box>
  )
}
