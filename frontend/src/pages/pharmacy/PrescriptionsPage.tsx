import { AssignmentOutlined, Search } from '@mui/icons-material'
import { Box, Chip, InputAdornment, Pagination, Paper, Skeleton, Stack, TextField, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useDeferredValue, useState } from 'react'
import { Link } from 'react-router-dom'
import { pharmacyApi } from '../../api/endpoints/pharmacy'
import { useAuthStore } from '../../stores/authStore'

/** The prescriptions book: every prescription-only sale, searchable by patient, prescriber or Rx number. */
export function PrescriptionsPage() {
  const currency = useAuthStore((s) => s.user?.business?.currency ?? '')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const deferred = useDeferredValue(search)
  const query = useQuery({
    queryKey: ['pharmacy', 'prescriptions', deferred, page],
    queryFn: () => pharmacyApi.prescriptions({ search: deferred || undefined, page }),
    placeholderData: (prev) => prev,
  })
  const rows = query.data?.data ?? []

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 800 }}>
        Prescriptions
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Every prescription dispensed, with the patient, prescriber and what was given.
      </Typography>
      <TextField
        placeholder="Search patient, prescriber or Rx number…"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value)
          setPage(1)
        }}
        size="small"
        fullWidth
        sx={{ mb: 2, maxWidth: 480, bgcolor: 'background.paper' }}
        slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search /></InputAdornment> } }}
      />

      {query.isLoading && <Skeleton variant="rounded" height={200} />}
      {query.isSuccess && rows.length === 0 && (
        <Paper variant="outlined" sx={{ p: 5, textAlign: 'center', borderRadius: '12px', borderStyle: 'dashed' }}>
          <AssignmentOutlined sx={{ fontSize: 48, color: 'text.disabled' }} />
          <Typography sx={{ fontWeight: 700 }}>{deferred ? 'No prescriptions match your search' : 'No prescriptions yet'}</Typography>
          <Typography variant="body2" color="text.secondary">
            When you dispense a prescription-only medicine, its prescription is saved here.
          </Typography>
        </Paper>
      )}

      <Stack spacing={1.25}>
        {rows.map((p) => (
          <Paper key={p.id} variant="outlined" sx={{ p: 2, borderRadius: '12px' }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ justifyContent: 'space-between', gap: 1 }}>
              <Box sx={{ minWidth: 0 }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                  <Typography sx={{ fontWeight: 800, fontSize: 16 }}>{p.patient_name}</Typography>
                  {p.patient_age != null && <Typography variant="body2" color="text.secondary">{p.patient_age} yrs</Typography>}
                  <Chip label={`Rx ${p.rx_number}`} size="small" color="primary" variant="outlined" sx={{ fontWeight: 700 }} />
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  Prescribed by <strong>{p.prescriber_name}</strong>
                  {p.prescriber_reg_no ? ` (Reg. ${p.prescriber_reg_no})` : ''}
                  {p.facility ? ` · ${p.facility}` : ''}
                </Typography>
              </Box>
              <Box sx={{ textAlign: { sm: 'right' }, flexShrink: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {new Date(p.created_at).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </Typography>
                {p.sale && (
                  <Typography variant="caption" color="text.secondary" component={Link} to={`/sales?receipt=${encodeURIComponent(p.sale.receipt_number)}`} sx={{ textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                    {p.sale.receipt_number} · {currency} {Number(p.sale.grand_total).toLocaleString()}
                  </Typography>
                )}
              </Box>
            </Stack>
            {(p.sale?.items?.length ?? 0) > 0 && (
              <Box sx={{ mt: 1.25, pt: 1.25, borderTop: '1px dashed', borderColor: 'divider' }}>
                {p.sale!.items.map((item) => (
                  <Typography key={item.id} variant="body2" sx={{ py: 0.25 }}>
                    <strong>{item.quantity} ×</strong> {item.product_name}
                    {item.dosage_instructions && <Box component="span" sx={{ color: 'primary.main', fontWeight: 600 }}> — {item.dosage_instructions}</Box>}
                  </Typography>
                ))}
              </Box>
            )}
            {p.notes && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                Note: {p.notes}
              </Typography>
            )}
          </Paper>
        ))}
      </Stack>

      {(query.data?.last_page ?? 1) > 1 && (
        <Stack sx={{ alignItems: 'center', mt: 2 }}>
          <Pagination count={query.data!.last_page} page={page} onChange={(_, v) => setPage(v)} color="primary" />
        </Stack>
      )}
    </Box>
  )
}
