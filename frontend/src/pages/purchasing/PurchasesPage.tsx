import { Add, Delete } from '@mui/icons-material'
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
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
import { purchasesApi, suppliersApi, type PurchaseItemPayload } from '../../api/endpoints/purchasing'
import { useAuthStore } from '../../stores/authStore'

const STATUS_COLORS: Record<string, 'default' | 'warning' | 'success' | 'error'> = {
  pending: 'default',
  partially_received: 'warning',
  received: 'success',
  cancelled: 'error',
};

export function PurchasesPage() {
  const queryClient = useQueryClient()
  const currency = useAuthStore((s) => s.user?.business?.currency ?? '')
  const canReceive = useAuthStore((s) => s.hasPermission('purchases.receive'))

  const [createOpen, setCreateOpen] = useState(false)
  const [detailId, setDetailId] = useState<number | null>(null)
  const [branchId, setBranchId] = useState<number | ''>('')
  const [supplierId, setSupplierId] = useState<number | ''>('')
  const [lines, setLines] = useState<PurchaseItemPayload[]>([])

  const purchasesQuery = useQuery({ queryKey: ['purchases'], queryFn: () => purchasesApi.list() })
  const branchesQuery = useQuery({ queryKey: ['branches'], queryFn: branchesApi.list })
  const suppliersQuery = useQuery({ queryKey: ['suppliers'], queryFn: suppliersApi.list })
  const productsQuery = useQuery({ queryKey: ['products', 'all'], queryFn: () => productsApi.list({ status: 'active' }) })

  const createMutation = useMutation({
    mutationFn: () => purchasesApi.create({ branch_id: Number(branchId), supplier_id: Number(supplierId), items: lines }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] })
      setCreateOpen(false)
      setLines([])
      setBranchId('')
      setSupplierId('')
    },
    meta: { successMessage: 'Purchase created.' },
  })

  function addLine() {
    setLines((prev) => [...prev, { product_id: 0, quantity_ordered: 1, unit_cost: 0 }])
  }

  function updateLine(index: number, patch: Partial<PurchaseItemPayload>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)))
  }

  return (
    <Box>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          Purchases
        </Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => setCreateOpen(true)}>
          New purchase
        </Button>
      </Stack>

      <Paper variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Number</TableCell>
              <TableCell>Supplier</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell align="right">Paid</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {purchasesQuery.data?.data?.map((p: any) => (
              <TableRow key={p.id} hover sx={{ cursor: 'pointer' }} onClick={() => setDetailId(p.id)}>
                <TableCell>{p.purchase_number}</TableCell>
                <TableCell>{p.supplier?.name}</TableCell>
                <TableCell>
                  <Chip label={p.status.replace('_', ' ')} size="small" color={STATUS_COLORS[p.status] ?? 'default'} />
                </TableCell>
                <TableCell align="right">
                  {currency} {Number(p.grand_total).toLocaleString()}
                </TableCell>
                <TableCell align="right">
                  {currency} {Number(p.amount_paid).toLocaleString()}
                </TableCell>
                <TableCell />
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New purchase</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction="row" spacing={2}>
              <TextField select label="Branch" value={branchId} onChange={(e) => setBranchId(Number(e.target.value))} fullWidth>
                {branchesQuery.data?.map((b) => (
                  <MenuItem key={b.id} value={b.id}>
                    {b.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField select label="Supplier" value={supplierId} onChange={(e) => setSupplierId(Number(e.target.value))} fullWidth>
                {suppliersQuery.data?.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.name}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>

            <Divider />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Line items
            </Typography>
            {lines.map((line, i) => (
              <Stack direction="row" spacing={1} key={i} sx={{ alignItems: 'center' }}>
                <TextField
                  select
                  label="Product"
                  size="small"
                  value={line.product_id || ''}
                  onChange={(e) => updateLine(i, { product_id: Number(e.target.value) })}
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
                  value={line.quantity_ordered}
                  onChange={(e) => updateLine(i, { quantity_ordered: Number(e.target.value) })}
                  sx={{ width: 90 }}
                />
                <TextField
                  label="Unit cost"
                  type="number"
                  size="small"
                  value={line.unit_cost}
                  onChange={(e) => updateLine(i, { unit_cost: Number(e.target.value) })}
                  sx={{ width: 120 }}
                />
                <IconButton size="small" onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}>
                  <Delete fontSize="small" />
                </IconButton>
              </Stack>
            ))}
            <Button startIcon={<Add />} size="small" onClick={addLine} sx={{ alignSelf: 'flex-start' }}>
              Add line
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!branchId || !supplierId || lines.length === 0 || lines.some((l) => !l.product_id)}
            loading={createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {detailId && <PurchaseDetailDialog id={detailId} canReceive={canReceive} currency={currency} onClose={() => setDetailId(null)} />}
    </Box>
  )
}

function PurchaseDetailDialog({ id, canReceive, currency, onClose }: { id: number; canReceive: boolean; currency: string; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [receiveQtys, setReceiveQtys] = useState<Record<number, number>>({})
  const [paymentAmount, setPaymentAmount] = useState('')

  const query = useQuery({ queryKey: ['purchases', id], queryFn: () => purchasesApi.show(id) })

  const receiveMutation = useMutation({
    mutationFn: () =>
      purchasesApi.receive(
        id,
        Object.entries(receiveQtys)
          .filter(([, qty]) => qty > 0)
          .map(([itemId, qty]) => ({ purchase_item_id: Number(itemId), quantity: qty })),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] })
      setReceiveQtys({})
    },
    meta: { successMessage: 'Stock received.' },
  })

  const paymentMutation = useMutation({
    mutationFn: () => purchasesApi.recordPayment(id, Number(paymentAmount)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] })
      setPaymentAmount('')
    },
    meta: { successMessage: 'Payment recorded.' },
  })

  const purchase = query.data

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{purchase?.purchase_number}</DialogTitle>
      <DialogContent>
        {purchase && (
          <Stack spacing={2}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Product</TableCell>
                  <TableCell align="right">Ordered</TableCell>
                  <TableCell align="right">Received</TableCell>
                  {canReceive && purchase.status !== 'received' && <TableCell align="right">Receive now</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {purchase.items.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.product?.name}</TableCell>
                    <TableCell align="right">{item.quantity_ordered}</TableCell>
                    <TableCell align="right">{item.quantity_received}</TableCell>
                    {canReceive && purchase.status !== 'received' && (
                      <TableCell align="right">
                        <TextField
                          type="number"
                          size="small"
                          value={receiveQtys[item.id] ?? ''}
                          onChange={(e) => setReceiveQtys({ ...receiveQtys, [item.id]: Number(e.target.value) })}
                          sx={{ width: 90 }}
                          slotProps={{ htmlInput: { max: item.quantity_ordered - item.quantity_received, min: 0 } }}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {canReceive && purchase.status !== 'received' && (
              <Button variant="outlined" loading={receiveMutation.isPending} onClick={() => receiveMutation.mutate()} sx={{ alignSelf: 'flex-start' }}>
                Receive stock
              </Button>
            )}

            <Divider />
            <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
              <Typography variant="body2">Total</Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {currency} {Number(purchase.grand_total).toLocaleString()}
              </Typography>
            </Stack>
            <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
              <Typography variant="body2">Paid</Typography>
              <Typography variant="body2">
                {currency} {Number(purchase.amount_paid).toLocaleString()}
              </Typography>
            </Stack>

            <Stack direction="row" spacing={1}>
              <TextField label="Record payment" type="number" size="small" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
              <Button variant="outlined" disabled={!paymentAmount} loading={paymentMutation.isPending} onClick={() => paymentMutation.mutate()}>
                Pay
              </Button>
            </Stack>
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
