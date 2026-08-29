import { Add } from '@mui/icons-material'
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormGroup,
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
import { stockTakesApi } from '../../api/endpoints/stockOps'
import { useAuthStore } from '../../stores/authStore'

const STATUS_COLORS: Record<string, 'default' | 'info' | 'success' | 'error'> = {
  draft: 'default',
  submitted: 'info',
  approved: 'success',
  cancelled: 'error',
}

export function StockTakesPage() {
  const queryClient = useQueryClient()
  const canApprove = useAuthStore((s) => s.hasPermission('stock_takes.approve'))
  const [createOpen, setCreateOpen] = useState(false)
  const [branchId, setBranchId] = useState<number | ''>('')
  const [selectedProducts, setSelectedProducts] = useState<number[]>([])
  const [detailId, setDetailId] = useState<number | null>(null)

  const stockTakesQuery = useQuery({ queryKey: ['stock-takes'], queryFn: () => stockTakesApi.list() })
  const branchesQuery = useQuery({ queryKey: ['branches'], queryFn: branchesApi.list })
  const productsQuery = useQuery({ queryKey: ['products', 'all'], queryFn: () => productsApi.list({ status: 'active' }) })

  const createMutation = useMutation({
    mutationFn: () => stockTakesApi.create(Number(branchId), selectedProducts),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['stock-takes'] })
      setCreateOpen(false)
      setSelectedProducts([])
      setDetailId(result.id)
    },
    meta: { successMessage: 'Stock count started.' },
  })

  return (
    <Box>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          Stock Taking
        </Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => setCreateOpen(true)}>
          New count
        </Button>
      </Stack>

      <Paper variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Branch</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Created</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {stockTakesQuery.data?.data?.map((st: any) => (
              <TableRow key={st.id} hover sx={{ cursor: 'pointer' }} onClick={() => setDetailId(st.id)}>
                <TableCell>{st.branch?.name}</TableCell>
                <TableCell>
                  <Chip label={st.status} size="small" color={STATUS_COLORS[st.status] ?? 'default'} />
                </TableCell>
                <TableCell>{new Date(st.created_at).toLocaleDateString()}</TableCell>
                <TableCell />
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>New stock count</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField select label="Branch" value={branchId} onChange={(e) => setBranchId(Number(e.target.value))} fullWidth>
              {branchesQuery.data?.map((b) => (
                <MenuItem key={b.id} value={b.id}>
                  {b.name}
                </MenuItem>
              ))}
            </TextField>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Products to count
            </Typography>
            <FormGroup sx={{ maxHeight: 300, overflowY: 'auto' }}>
              {productsQuery.data?.data.map((p) => (
                <FormControlLabel
                  key={p.id}
                  control={
                    <Checkbox
                      checked={selectedProducts.includes(p.id)}
                      onChange={() =>
                        setSelectedProducts((prev) => (prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id]))
                      }
                    />
                  }
                  label={p.name}
                />
              ))}
            </FormGroup>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!branchId || selectedProducts.length === 0}
            loading={createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            Start count
          </Button>
        </DialogActions>
      </Dialog>

      {detailId && <StockTakeDetailDialog id={detailId} canApprove={canApprove} onClose={() => setDetailId(null)} />}
    </Box>
  )
}

function StockTakeDetailDialog({ id, canApprove, onClose }: { id: number; canApprove: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [counts, setCounts] = useState<Record<number, number>>({})

  const query = useQuery({ queryKey: ['stock-takes', id], queryFn: () => stockTakesApi.show(id) })

  const saveMutation = useMutation({
    mutationFn: () =>
      stockTakesApi.recordCounts(
        id,
        Object.entries(counts).map(([itemId, counted_quantity]) => ({ item_id: Number(itemId), counted_quantity })),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stock-takes', id] }),
    meta: { successMessage: 'Counts saved.' },
  })

  const submitMutation = useMutation({
    mutationFn: () => stockTakesApi.submit(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-takes'] })
      queryClient.invalidateQueries({ queryKey: ['stock-takes', id] })
    },
    meta: { successMessage: 'Stock count submitted for approval.' },
  })

  const approveMutation = useMutation({
    mutationFn: () => stockTakesApi.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-takes'] })
      queryClient.invalidateQueries({ queryKey: ['stock-takes', id] })
    },
    meta: { successMessage: 'Variances approved.' },
  })

  const stockTake = query.data
  const allCounted = stockTake?.items.every((item: any) => item.counted_quantity !== null || counts[item.id] !== undefined)

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Stock count — {stockTake?.branch?.name}
        <Chip label={stockTake?.status} size="small" sx={{ ml: 1 }} />
      </DialogTitle>
      <DialogContent>
        {stockTake && (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Product</TableCell>
                <TableCell align="right">System qty</TableCell>
                <TableCell align="right">Counted</TableCell>
                <TableCell align="right">Variance</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {stockTake.items.map((item: any) => {
                const counted = counts[item.id] ?? item.counted_quantity
                const variance = counted !== null && counted !== undefined ? counted - item.system_quantity : null
                return (
                  <TableRow key={item.id}>
                    <TableCell>{item.product?.name}</TableCell>
                    <TableCell align="right">{item.system_quantity}</TableCell>
                    <TableCell align="right">
                      {stockTake.status === 'draft' ? (
                        <TextField
                          type="number"
                          size="small"
                          value={counts[item.id] ?? item.counted_quantity ?? ''}
                          onChange={(e) => setCounts({ ...counts, [item.id]: Number(e.target.value) })}
                          sx={{ width: 90 }}
                        />
                      ) : (
                        item.counted_quantity
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {variance !== null && (
                        <Chip label={variance > 0 ? `+${variance}` : variance} size="small" color={variance === 0 ? 'success' : 'warning'} />
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Close</Button>
        {stockTake?.status === 'draft' && (
          <>
            <Button loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              Save counts
            </Button>
            <Button variant="outlined" disabled={!allCounted} loading={submitMutation.isPending} onClick={() => submitMutation.mutate()}>
              Submit
            </Button>
          </>
        )}
        {stockTake?.status === 'submitted' && canApprove && (
          <Button variant="contained" loading={approveMutation.isPending} onClick={() => approveMutation.mutate()}>
            Approve variances
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
