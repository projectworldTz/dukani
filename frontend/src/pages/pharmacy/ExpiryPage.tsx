import { DeleteForeverRounded, EventAvailableRounded, EventBusyRounded, HourglassBottomRounded } from '@mui/icons-material'
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { inventoryApi } from '../../api/endpoints/inventory'
import { expiryStatus, medicineSubtitle, pharmacyApi, type ExpiryRow } from '../../api/endpoints/pharmacy'
import { useActiveBranch } from '../../hooks/useActiveBranch'
import { useAuthStore } from '../../stores/authStore'

type View = 'expiring' | 'expired'

function SummaryTile({ icon, label, value, hint, tone }: { icon: React.ReactNode; label: string; value: string; hint: string; tone: 'red' | 'amber' | 'teal' }) {
  const colors = { red: ['#FEF2F2', '#FECACA', '#DC2626'], amber: ['#FFFBEB', '#FDE68A', '#D97706'], teal: ['#F0FDFA', '#99F6E4', '#0D9488'] }[tone]
  return (
    <Box sx={{ p: 2, borderRadius: '12px', bgcolor: colors[0], border: '1px solid', borderColor: colors[1], display: 'flex', gap: 1.5, alignItems: 'center', minWidth: 0 }}>
      <Box sx={{ width: 44, height: 44, borderRadius: '50%', bgcolor: colors[2], color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
          {label}
        </Typography>
        <Typography sx={{ fontWeight: 800, fontSize: 22, lineHeight: 1.2 }} noWrap>
          {value}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap component="div">
          {hint}
        </Typography>
      </Box>
    </Box>
  )
}

/** Stock & Expiry: every batch that has expired or is about to, with one-tap removal. */
export function ExpiryPage() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const queryClient = useQueryClient()
  const currency = useAuthStore((s) => s.user?.business?.currency ?? '')
  const canAdjust = useAuthStore((s) => s.hasPermission('inventory.adjust'))
  const { branchId } = useActiveBranch()
  const [view, setView] = useState<View>('expiring')
  const [within, setWithin] = useState(90)
  const [removing, setRemoving] = useState<ExpiryRow | null>(null)

  const summaryQuery = useQuery({ queryKey: ['pharmacy', 'summary', branchId], queryFn: () => pharmacyApi.summary(branchId ?? undefined), enabled: !!branchId })
  const rowsQuery = useQuery({
    queryKey: ['pharmacy', 'expiry', view, within, branchId],
    queryFn: () => pharmacyApi.expiry({ status: view, within_days: within, branch_id: branchId ?? undefined }),
    enabled: !!branchId,
  })
  const rows = rowsQuery.data ?? []
  const totalValue = rows.reduce((sum, r) => sum + r.value_at_cost, 0)

  const removeMutation = useMutation({
    mutationFn: (row: ExpiryRow) =>
      inventoryApi.adjust(row.product!.id, {
        branch_id: row.branch?.id ?? branchId!,
        type: 'expired',
        quantity_change: -row.quantity_remaining,
        batch_id: row.id,
        reason: `Expired batch ${row.batch_number} removed`,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pharmacy'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      setRemoving(null)
    },
    meta: { successMessage: 'Expired batch removed from stock.' },
  })

  const s = summaryQuery.data
  const money = (n: number) => `${currency} ${Math.round(n).toLocaleString()}`

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 800 }}>
        Stock & Expiry
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        Medicines that have expired or will expire soon. Expired stock can't be sold — remove it so your counts stay right.
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 1.5, mb: 2.5 }}>
        <SummaryTile tone="red" icon={<EventBusyRounded />} label="Expired" value={s ? `${s.expired_units} units` : '…'} hint={s ? `${s.expired_batches} batch(es) to remove` : ' '} />
        <SummaryTile tone="amber" icon={<HourglassBottomRounded />} label="Expiring in 30 days" value={s ? `${s.expiring_30_batches} batch(es)` : '…'} hint="Sell these first or return them" />
        <SummaryTile tone="teal" icon={<EventAvailableRounded />} label="Expiring in 90 days" value={s ? `${s.expiring_90_units} units` : '…'} hint={s ? `${s.expiring_90_batches} batch(es)` : ' '} />
      </Box>

      <Paper variant="outlined" sx={{ borderRadius: '12px', overflow: 'hidden' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' }, borderBottom: '1px solid', borderColor: 'divider', pr: { sm: 1.5 } }}>
          <Tabs value={view} onChange={(_, v: View) => setView(v)} sx={{ px: 1, '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, minHeight: 52 } }}>
            <Tab value="expiring" label="Expiring soon" />
            <Tab value="expired" label={<Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}><span>Expired</span>{(s?.expired_batches ?? 0) > 0 && <Chip label={s!.expired_batches} size="small" color="error" />}</Stack>} />
          </Tabs>
          {view === 'expiring' && (
            <TextField select size="small" value={within} onChange={(e) => setWithin(Number(e.target.value))} sx={{ m: { xs: 1.5, sm: 0 }, minWidth: 170 }}>
              <MenuItem value={30}>Next 30 days</MenuItem>
              <MenuItem value={90}>Next 90 days</MenuItem>
              <MenuItem value={180}>Next 6 months</MenuItem>
              <MenuItem value={365}>Next 12 months</MenuItem>
            </TextField>
          )}
        </Stack>

        {rowsQuery.isLoading ? (
          <Box sx={{ p: 2 }}>
            <Skeleton variant="rounded" height={160} />
          </Box>
        ) : rows.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography sx={{ fontWeight: 700 }}>{view === 'expired' ? 'No expired stock 👍' : 'Nothing expires in this period 👍'}</Typography>
            <Typography variant="body2" color="text.secondary">
              {view === 'expired' ? 'Everything on your shelves is still in date.' : 'Check again later or choose a longer period.'}
            </Typography>
          </Box>
        ) : (
          <>
            {rows.map((r) => {
              const status = expiryStatus(r.expiry_date)
              return (
                <Stack
                  key={r.id}
                  direction={isMobile ? 'column' : 'row'}
                  spacing={isMobile ? 1 : 2}
                  sx={{ alignItems: isMobile ? 'stretch' : 'center', px: 2, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}
                >
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography component="div" sx={{ fontWeight: 700 }} noWrap>
                      {r.product?.name ?? 'Deleted medicine'}
                      {r.product?.is_controlled && <Chip label="CD" size="small" color="error" sx={{ ml: 1, height: 20, fontSize: 11 }} />}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" component="div" noWrap>
                      {[r.product ? medicineSubtitle(r.product) : '', `Batch ${r.batch_number}`].filter(Boolean).join(' · ')}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: isMobile ? 'space-between' : 'flex-end' }}>
                    <Box sx={{ textAlign: isMobile ? 'left' : 'right' }}>
                      <Chip label={status.label} size="small" color={status.color} />
                      <Typography variant="caption" color="text.secondary" component="div">
                        {r.is_expired ? `${Math.abs(r.days_until_expiry)} day(s) ago` : `in ${r.days_until_expiry} day(s)`}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right', minWidth: 90 }}>
                      <Typography sx={{ fontWeight: 800 }}>{r.quantity_remaining} units</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {money(r.value_at_cost)}
                      </Typography>
                    </Box>
                    {r.is_expired && canAdjust && (
                      <Button color="error" variant="contained" startIcon={<DeleteForeverRounded />} onClick={() => setRemoving(r)} sx={{ whiteSpace: 'nowrap' }}>
                        Remove
                      </Button>
                    )}
                  </Stack>
                </Stack>
              )
            })}
            <Box sx={{ px: 2, py: 1.5, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'grey.50', textAlign: 'right' }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {rows.length} batch(es) · {money(totalValue)} at cost
              </Typography>
            </Box>
          </>
        )}
      </Paper>

      <Dialog open={!!removing} onClose={() => setRemoving(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Remove expired batch?</DialogTitle>
        <DialogContent>
          <Typography>
            {removing?.quantity_remaining} unit(s) of <strong>{removing?.product?.name}</strong> (batch {removing?.batch_number}) will be taken out of stock and recorded as expired.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            Dispose of expired medicine safely, following TMDA guidelines.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRemoving(null)}>Cancel</Button>
          <Button color="error" variant="contained" loading={removeMutation.isPending} onClick={() => removing && removeMutation.mutate(removing)}>
            Remove from stock
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
