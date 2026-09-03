import { Add, Delete } from '@mui/icons-material'
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { branchesApi } from '../../api/endpoints/branches'
import { productsApi } from '../../api/endpoints/products'
import { stockTransfersApi } from '../../api/endpoints/stockOps'
import { useAuthStore } from '../../stores/authStore'
import { useToastStore } from '../../stores/toastStore'

const STATUS_COLORS: Record<string, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  draft: 'default',
  requested: 'info',
  approved: 'warning',
  in_transit: 'warning',
  received: 'success',
  cancelled: 'error',
}

const NEXT_ACTION: Record<string, { action: string; label: string; permission: string }> = {
  draft: { action: 'request', label: 'Request', permission: 'stock_transfers.manage' },
  requested: { action: 'approve', label: 'Approve', permission: 'stock_transfers.approve' },
  approved: { action: 'dispatch', label: 'Dispatch', permission: 'stock_transfers.manage' },
  in_transit: { action: 'receive', label: 'Receive', permission: 'stock_transfers.manage' },
}

export function StockTransfersPage() {
  const queryClient = useQueryClient()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const [createOpen, setCreateOpen] = useState(false)
  const [fromBranch, setFromBranch] = useState<number | ''>('')
  const [toBranch, setToBranch] = useState<number | ''>('')
  const [lines, setLines] = useState<{ product_id: number; quantity: number }[]>([])

  const transfersQuery = useQuery({ queryKey: ['stock-transfers'], queryFn: () => stockTransfersApi.list() })
  const branchesQuery = useQuery({ queryKey: ['branches'], queryFn: branchesApi.list })
  const productsQuery = useQuery({ queryKey: ['products', 'all'], queryFn: () => productsApi.list({ status: 'active' }) })

  const createMutation = useMutation({
    mutationFn: () => stockTransfersApi.create({ from_branch_id: Number(fromBranch), to_branch_id: Number(toBranch), items: lines }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-transfers'] })
      setCreateOpen(false)
      setLines([])
    },
    meta: { successMessage: 'Stock transfer created.' },
  })

  const ACTION_MESSAGES: Record<string, string> = {
    request: 'Transfer requested.',
    approve: 'Transfer approved.',
    dispatch: 'Transfer dispatched.',
    receive: 'Transfer received.',
    cancel: 'Transfer cancelled.',
  }

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: string }) => {
      const fn = { request: stockTransfersApi.request, approve: stockTransfersApi.approve, dispatch: stockTransfersApi.dispatch, receive: stockTransfersApi.receive, cancel: stockTransfersApi.cancel }[action]!
      return fn(id)
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['stock-transfers'] })
      useToastStore.getState().show(ACTION_MESSAGES[variables.action] ?? 'Stock transfer updated.', 'success')
    },
  })

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' }, mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          Stock Transfers
        </Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => setCreateOpen(true)}>
          New transfer
        </Button>
      </Stack>

      <Paper variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Number</TableCell>
              <TableCell>From</TableCell>
              <TableCell>To</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {transfersQuery.data?.data?.map((t: any) => {
              const next = NEXT_ACTION[t.status]
              return (
                <TableRow key={t.id}>
                  <TableCell>{t.transfer_number}</TableCell>
                  <TableCell>{t.from_branch?.name}</TableCell>
                  <TableCell>{t.to_branch?.name}</TableCell>
                  <TableCell>
                    <Chip label={t.status.replace('_', ' ')} size="small" color={STATUS_COLORS[t.status] ?? 'default'} />
                  </TableCell>
                  <TableCell align="right">
                    {next && hasPermission(next.permission) && (
                      <Button size="small" loading={actionMutation.isPending} onClick={() => actionMutation.mutate({ id: t.id, action: next.action })}>
                        {next.label}
                      </Button>
                    )}
                    {!['received', 'cancelled', 'in_transit'].includes(t.status) && hasPermission('stock_transfers.manage') && (
                      <Button size="small" color="error" onClick={() => actionMutation.mutate({ id: t.id, action: 'cancel' })}>
                        Cancel
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New stock transfer</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField select label="From branch" value={fromBranch} onChange={(e) => setFromBranch(Number(e.target.value))} fullWidth>
                {branchesQuery.data?.map((b) => (
                  <MenuItem key={b.id} value={b.id}>
                    {b.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField select label="To branch" value={toBranch} onChange={(e) => setToBranch(Number(e.target.value))} fullWidth>
                {branchesQuery.data?.map((b) => (
                  <MenuItem key={b.id} value={b.id} disabled={b.id === fromBranch}>
                    {b.name}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>

            {lines.map((line, i) => (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} key={i} sx={{ alignItems: { xs: 'stretch', sm: 'center' }, borderBottom: { xs: '1px solid', sm: 0 }, borderColor: 'divider', pb: { xs: 1.5, sm: 0 } }}>
                <TextField
                  select
                  label="Product"
                  size="small"
                  value={line.product_id || ''}
                  onChange={(e) => setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, product_id: Number(e.target.value) } : l)))}
                  sx={{ flexGrow: 1 }}
                >
                  {productsQuery.data?.data.map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Qty"
                  type="number"
                  size="small"
                  value={line.quantity}
                  onChange={(e) => setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, quantity: Number(e.target.value) } : l)))}
                  sx={{ width: { xs: '100%', sm: 100 } }}
                />
                <IconButton size="small" onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))} sx={{ alignSelf: { xs: 'flex-end', sm: 'center' } }}>
                  <Delete fontSize="small" />
                </IconButton>
              </Stack>
            ))}
            <Button startIcon={<Add />} size="small" onClick={() => setLines((prev) => [...prev, { product_id: 0, quantity: 1 }])} sx={{ alignSelf: 'flex-start' }}>
              Add product
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!fromBranch || !toBranch || lines.length === 0 || lines.some((l) => !l.product_id)}
            loading={createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
