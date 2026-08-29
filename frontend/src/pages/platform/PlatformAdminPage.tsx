import { Block, CheckCircle, DeleteForever, EventAvailable, RestoreFromTrash } from '@mui/icons-material'
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid,
  Link,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { platformApi } from '../../api/endpoints/platform'
import { useToastStore } from '../../stores/toastStore'
import { BusinessDetailDialog } from './BusinessDetailDialog'

function LicenseCell({ expiresAt }: { expiresAt: string | null }) {
  if (!expiresAt) {
    return (
      <Typography variant="body2" color="text.secondary">
        No license set
      </Typography>
    )
  }

  const date = new Date(expiresAt)
  const daysLeft = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  const expired = daysLeft < 0
  const expiringSoon = !expired && daysLeft <= 30

  return (
    <Stack spacing={0.25}>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
      </Typography>
      {expired ? (
        <Chip label="Expired" size="small" color="error" variant="outlined" sx={{ width: 'fit-content' }} />
      ) : expiringSoon ? (
        <Chip label={`${daysLeft} day${daysLeft === 1 ? '' : 's'} left`} size="small" color="warning" variant="outlined" sx={{ width: 'fit-content' }} />
      ) : (
        <Typography variant="caption" color="text.secondary">
          {daysLeft} days left
        </Typography>
      )}
    </Stack>
  )
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  )
}

export function PlatformAdminPage() {
  const queryClient = useQueryClient()
  const [detailId, setDetailId] = useState<number | null>(null)
  const [showTrashed, setShowTrashed] = useState(false)
  const [reasonDialog, setReasonDialog] = useState<{ mode: 'delete' | 'restore'; id: number; name: string } | null>(null)
  const [reason, setReason] = useState('')
  const businessesQuery = useQuery({
    queryKey: ['platform', 'businesses', showTrashed],
    queryFn: () => platformApi.businesses(showTrashed),
  })
  const statsQuery = useQuery({ queryKey: ['platform', 'stats'], queryFn: () => platformApi.stats() })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'active' | 'suspended' }) => platformApi.updateStatus(id, status),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['platform'] })
      useToastStore.getState().show(variables.status === 'active' ? 'Business activated.' : 'Business suspended.', 'success')
    },
  })

  const extendLicenseMutation = useMutation({
    mutationFn: ({ id, months }: { id: number; months: 6 | 12 }) => platformApi.extendLicense(id, months),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['platform'] })
      useToastStore.getState().show(`License extended by ${variables.months} months.`, 'success')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => platformApi.deleteBusiness(id, reason),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['platform'] })
      useToastStore.getState().show(data.message, 'success')
      closeReasonDialog()
    },
  })

  const restoreMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => platformApi.restoreBusiness(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform'] })
      useToastStore.getState().show('Business restored.', 'success')
      closeReasonDialog()
    },
  })

  function closeReasonDialog() {
    setReasonDialog(null)
    setReason('')
  }

  function confirmReasonDialog() {
    if (!reasonDialog || !reason.trim()) return
    if (reasonDialog.mode === 'delete') {
      deleteMutation.mutate({ id: reasonDialog.id, reason: reason.trim() })
    } else {
      restoreMutation.mutate({ id: reasonDialog.id, reason: reason.trim() })
    }
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 3 }}>
        Platform Admin
      </Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <StatCard label="Total businesses" value={statsQuery.data?.total_businesses ?? '—'} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <StatCard label="Active" value={statsQuery.data?.active_businesses ?? '—'} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <StatCard label="Suspended" value={statsQuery.data?.suspended_businesses ?? '—'} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <StatCard label="Active in last 30 days" value={statsQuery.data?.businesses_with_a_sale_last_30_days ?? '—'} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <StatCard label="Completed sales (all time)" value={statsQuery.data?.total_completed_sales ?? '—'} />
        </Grid>
      </Grid>

      <Tabs value={showTrashed ? 1 : 0} onChange={(_, v) => setShowTrashed(v === 1)} sx={{ mb: 2 }}>
        <Tab label="Active businesses" />
        <Tab label="Deleted businesses" />
      </Tabs>

      <Paper variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Business</TableCell>
              <TableCell>Category</TableCell>
              {showTrashed ? <TableCell>Deletion reason</TableCell> : <TableCell>Plan</TableCell>}
              <TableCell>Currency</TableCell>
              <TableCell align="right">Staff</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>License</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {businessesQuery.data?.map((b) => (
              <TableRow key={b.id} hover>
                <TableCell>
                  <Link component="button" underline="hover" sx={{ fontWeight: 600 }} onClick={() => setDetailId(b.id)}>
                    {b.name}
                  </Link>
                </TableCell>
                <TableCell>{b.category ?? '—'}</TableCell>
                {showTrashed ? (
                  <TableCell sx={{ maxWidth: 240 }}>
                    <Typography variant="body2" color="text.secondary" noWrap title={b.deletion_reason ?? undefined}>
                      {b.deletion_reason ?? '—'}
                    </Typography>
                  </TableCell>
                ) : (
                  <TableCell>{b.plan}</TableCell>
                )}
                <TableCell>{b.currency}</TableCell>
                <TableCell align="right">{b.users_count}</TableCell>
                <TableCell>
                  <Chip
                    label={b.status}
                    size="small"
                    color={b.status === 'active' ? 'success' : 'warning'}
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>
                  <LicenseCell expiresAt={b.license_expires_at} />
                </TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    {showTrashed ? (
                      <Button
                        size="small"
                        color="success"
                        variant="outlined"
                        startIcon={<RestoreFromTrash />}
                        onClick={() => setReasonDialog({ mode: 'restore', id: b.id, name: b.name })}
                      >
                        Restore
                      </Button>
                    ) : (
                      <>
                        <Tooltip title="Extend license by 6 months">
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<EventAvailable />}
                            loading={extendLicenseMutation.isPending}
                            onClick={() => extendLicenseMutation.mutate({ id: b.id, months: 6 })}
                          >
                            +6mo
                          </Button>
                        </Tooltip>
                        <Tooltip title="Extend license by 12 months">
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<EventAvailable />}
                            loading={extendLicenseMutation.isPending}
                            onClick={() => extendLicenseMutation.mutate({ id: b.id, months: 12 })}
                          >
                            +12mo
                          </Button>
                        </Tooltip>
                        {b.status === 'active' ? (
                          <Button
                            size="small"
                            color="warning"
                            startIcon={<Block />}
                            loading={statusMutation.isPending}
                            onClick={() => statusMutation.mutate({ id: b.id, status: 'suspended' })}
                          >
                            Suspend
                          </Button>
                        ) : (
                          <Button
                            size="small"
                            color="success"
                            startIcon={<CheckCircle />}
                            loading={statusMutation.isPending}
                            onClick={() => statusMutation.mutate({ id: b.id, status: 'active' })}
                          >
                            Activate
                          </Button>
                        )}
                        <Tooltip title="Soft delete this business — reversible from the Deleted businesses tab">
                          <Button
                            size="small"
                            color="error"
                            startIcon={<DeleteForever />}
                            onClick={() => setReasonDialog({ mode: 'delete', id: b.id, name: b.name })}
                          >
                            Delete
                          </Button>
                        </Tooltip>
                      </>
                    )}
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <BusinessDetailDialog businessId={detailId} onClose={() => setDetailId(null)} />

      <Dialog open={!!reasonDialog} onClose={closeReasonDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {reasonDialog?.mode === 'delete' ? `Delete ${reasonDialog?.name}?` : `Restore ${reasonDialog?.name}?`}
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            {reasonDialog?.mode === 'delete' ? (
              <>
                This signs out every staff member and blocks all access to <strong>{reasonDialog?.name}</strong>. Its
                sales, products, and other records are kept and this can be undone later from the "Deleted
                businesses" tab.
              </>
            ) : (
              <>
                This restores full access to <strong>{reasonDialog?.name}</strong> — its staff can sign in again
                immediately.
              </>
            )}
          </DialogContentText>
          <TextField
            autoFocus
            fullWidth
            required
            multiline
            minRows={2}
            label={reasonDialog?.mode === 'delete' ? 'Reason for deleting this shop' : 'Reason for restoring this shop'}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            error={reason.trim() === ''}
            helperText={reason.trim() === '' ? 'A reason is required.' : ' '}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeReasonDialog}>Cancel</Button>
          <Button
            color={reasonDialog?.mode === 'delete' ? 'error' : 'success'}
            variant="contained"
            disabled={!reason.trim()}
            loading={deleteMutation.isPending || restoreMutation.isPending}
            onClick={confirmReasonDialog}
          >
            {reasonDialog?.mode === 'delete' ? 'Delete business' : 'Restore business'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
