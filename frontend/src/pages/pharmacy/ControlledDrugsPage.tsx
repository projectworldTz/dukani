import { GppMaybeOutlined, PrintRounded } from '@mui/icons-material'
import { Alert, Box, Button, Chip, MenuItem, Pagination, Paper, Skeleton, Stack, TextField, Typography, useMediaQuery, useTheme } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { medicineSubtitle, pharmacyApi, type ControlledEntry } from '../../api/endpoints/pharmacy'
import { productsApi } from '../../api/endpoints/products'

const TYPE_CHIP: Record<ControlledEntry['type'], { label: string; color: 'success' | 'primary' | 'info' | 'error' | 'warning' }> = {
  received: { label: 'Received', color: 'success' },
  dispensed: { label: 'Dispensed', color: 'primary' },
  returned: { label: 'Returned', color: 'info' },
  removed: { label: 'Removed', color: 'error' },
  adjusted: { label: 'Count fixed', color: 'warning' },
}

/**
 * Controlled drugs register — written automatically whenever a controlled medicine is
 * received, dispensed, returned, removed or recounted. Shows the running balance, the
 * way an inspector expects to read it, and prints cleanly.
 */
export function ControlledDrugsPage() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [productId, setProductId] = useState<number | ''>('')
  const [page, setPage] = useState(1)

  // Controlled medicines for the filter (the list is small in practice).
  const medicinesQuery = useQuery({
    queryKey: ['products', 'controlled-filter'],
    queryFn: () => productsApi.list({ per_page: 100 }),
    select: (d) => d.data.filter((p) => p.is_controlled),
  })
  const registerQuery = useQuery({
    queryKey: ['pharmacy', 'controlled', productId, page],
    queryFn: () => pharmacyApi.controlledRegister({ product_id: productId || undefined, page }),
    placeholderData: (prev) => prev,
  })
  const rows = registerQuery.data?.data ?? []
  const when = (d: string) => new Date(d).toLocaleString([], { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' }, gap: 1.5, mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            Controlled Drugs Register
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Filled in automatically for every controlled medicine received, dispensed, returned or removed.
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<PrintRounded />} onClick={() => window.print()} sx={{ alignSelf: { xs: 'stretch', sm: 'center' }, '@media print': { display: 'none' } }}>
          Print register
        </Button>
      </Stack>

      <TextField select size="small" label="Medicine" value={productId} onChange={(e) => { setProductId(e.target.value === '' ? '' : Number(e.target.value)); setPage(1) }} sx={{ mb: 2, minWidth: { xs: '100%', sm: 320 }, bgcolor: 'background.paper' }} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
        <MenuItem value="">All controlled medicines</MenuItem>
        {(medicinesQuery.data ?? []).map((m) => (
          <MenuItem key={m.id} value={m.id}>
            {m.name}
            {medicineSubtitle(m) ? ` — ${medicineSubtitle(m)}` : ''}
          </MenuItem>
        ))}
      </TextField>

      {medicinesQuery.isSuccess && (medicinesQuery.data?.length ?? 0) === 0 && (
        <Alert severity="info" icon={<GppMaybeOutlined />} sx={{ mb: 2 }}>
          No medicine is marked as a controlled drug yet. Edit a medicine and switch on “Controlled drug” to start its register.
        </Alert>
      )}

      {registerQuery.isLoading ? (
        <Skeleton variant="rounded" height={220} />
      ) : rows.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 5, textAlign: 'center', borderRadius: '12px', borderStyle: 'dashed' }}>
          <Typography sx={{ fontWeight: 700 }}>No entries yet</Typography>
          <Typography variant="body2" color="text.secondary">
            Entries appear here as soon as a controlled medicine is received or dispensed.
          </Typography>
        </Paper>
      ) : isMobile ? (
        <Stack spacing={1}>
          {rows.map((r) => (
            <Paper key={r.id} variant="outlined" sx={{ p: 1.75, borderRadius: '12px' }}>
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700 }} noWrap>
                    {r.product?.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {when(r.created_at)}
                  </Typography>
                </Box>
                <Chip label={TYPE_CHIP[r.type].label} size="small" color={TYPE_CHIP[r.type].color} />
              </Stack>
              <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                <Typography variant="body2">In <strong>{r.quantity_in || '—'}</strong></Typography>
                <Typography variant="body2">Out <strong>{r.quantity_out || '—'}</strong></Typography>
                <Typography variant="body2">Balance <strong>{r.balance_after}</strong></Typography>
              </Stack>
              {(r.patient_name || r.prescriber_name) && (
                <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
                  {[r.patient_name && `Patient: ${r.patient_name}`, r.prescriber_name && `Prescriber: ${r.prescriber_name}`].filter(Boolean).join(' · ')}
                </Typography>
              )}
            </Paper>
          ))}
        </Stack>
      ) : (
        <Paper variant="outlined" sx={{ borderRadius: '12px', overflowX: 'auto' }}>
          <Box
            component="table"
            sx={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 14,
              '& th': { textAlign: 'left', fontWeight: 700, color: 'text.secondary', bgcolor: '#F8FAFC', px: 1.5, py: 1.25, whiteSpace: 'nowrap', fontSize: 13 },
              '& td': { px: 1.5, py: 1.1, borderTop: '1px solid', borderColor: 'divider', verticalAlign: 'top' },
            }}
          >
            <thead>
              <tr>
                <th>Date & time</th>
                <th>Medicine</th>
                <th>Entry</th>
                <th style={{ textAlign: 'right' }}>In</th>
                <th style={{ textAlign: 'right' }}>Out</th>
                <th style={{ textAlign: 'right' }}>Balance</th>
                <th>Batch</th>
                <th>Patient / prescriber</th>
                <th>Reference</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{when(r.created_at)}</td>
                  <td>
                    <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{r.product?.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{r.product ? medicineSubtitle(r.product) : ''}</Typography>
                  </td>
                  <td>
                    <Chip label={TYPE_CHIP[r.type].label} size="small" color={TYPE_CHIP[r.type].color} />
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#15803D' }}>{r.quantity_in || ''}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#B91C1C' }}>{r.quantity_out || ''}</td>
                  <td style={{ textAlign: 'right', fontWeight: 800 }}>{r.balance_after}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{r.batch?.batch_number ?? '—'}</td>
                  <td>
                    {r.patient_name && <div>{r.patient_name}</div>}
                    {r.prescriber_name && <Typography variant="caption" color="text.secondary">{r.prescriber_name}</Typography>}
                    {!r.patient_name && !r.prescriber_name && '—'}
                  </td>
                  <td>{r.sale?.receipt_number ?? r.reference ?? '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{r.recorder?.name ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </Box>
        </Paper>
      )}

      {(registerQuery.data?.last_page ?? 1) > 1 && (
        <Stack sx={{ alignItems: 'center', mt: 2 }}>
          <Pagination count={registerQuery.data!.last_page} page={page} onChange={(_, v) => setPage(v)} color="primary" />
        </Stack>
      )}
    </Box>
  )
}
