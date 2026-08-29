import {
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import { Print } from '@mui/icons-material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { salesApi } from '../../api/endpoints/sales'
import { ReceiptDialog } from '../pos/ReceiptDialog'
import { useAuthStore } from '../../stores/authStore'
import type { Sale } from '../../types'

const STATUS_COLORS: Record<string, 'default' | 'success' | 'warning' | 'error'> = {
  held: 'default',
  completed: 'success',
  partially_refunded: 'warning',
  refunded: 'error',
  cancelled: 'error',
}

export function SalesHistoryPage() {
  const currency = useAuthStore((s) => s.user?.business?.currency ?? '')
  const canReturn = useAuthStore((s) => s.hasPermission('sales.return'))
  const [detailId, setDetailId] = useState<number | null>(null)

  const salesQuery = useQuery({ queryKey: ['sales', 'history'], queryFn: () => salesApi.list({ status: 'completed' }) })

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 3 }}>
        Sales History
      </Typography>

      <Paper variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Receipt #</TableCell>
              <TableCell>Cashier</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell align="right">Paid</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {salesQuery.data?.data?.map((s: any) => (
              <TableRow key={s.id} hover sx={{ cursor: 'pointer' }} onClick={() => setDetailId(s.id)}>
                <TableCell>{s.receipt_number}</TableCell>
                <TableCell>{s.cashier?.name}</TableCell>
                <TableCell>
                  <Chip label={s.status.replace('_', ' ')} size="small" color={STATUS_COLORS[s.status] ?? 'default'} />
                </TableCell>
                <TableCell align="right">
                  {currency} {Number(s.grand_total).toLocaleString()}
                </TableCell>
                <TableCell align="right">
                  {currency} {Number(s.amount_paid).toLocaleString()}
                </TableCell>
                <TableCell />
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      {detailId && <SaleDetailDialog id={detailId} canReturn={canReturn} currency={currency} onClose={() => setDetailId(null)} />}
    </Box>
  )
}

function SaleDetailDialog({ id, canReturn, currency, onClose }: { id: number; canReturn: boolean; currency: string; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [returnMode, setReturnMode] = useState(false);
  const [selected, setSelected] = useState<Record<number, { quantity: number; condition: 'sellable' | 'damaged' }>>({})
  const [reason, setReason] = useState('')
  const [receiptSale, setReceiptSale] = useState<Sale | null>(null)

  const query = useQuery({ queryKey: ['sales', id], queryFn: () => salesApi.show(id) })

  const returnMutation = useMutation({
    mutationFn: () =>
      salesApi.createReturn(
        id,
        Object.entries(selected)
          .filter(([, v]) => v.quantity > 0)
          .map(([itemId, v]) => ({ sale_item_id: Number(itemId), quantity: v.quantity, condition: v.condition })),
        reason,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      setReturnMode(false)
      setSelected({})
    },
    meta: { successMessage: 'Return processed.' },
  })

  const sale = query.data

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{sale?.receipt_number}</DialogTitle>
      <DialogContent>
        {sale && (
          <Stack spacing={2}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {returnMode && <TableCell padding="checkbox" />}
                  <TableCell>Product</TableCell>
                  <TableCell align="right">Qty</TableCell>
                  <TableCell align="right">Line total</TableCell>
                  {returnMode && <TableCell>Condition</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {(sale.items ?? []).map((item: any) => (
                  <TableRow key={item.id}>
                    {returnMode && (
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={!!selected[item.id]}
                          onChange={(e) =>
                            setSelected((prev) => {
                              const next = { ...prev }
                              if (e.target.checked) next[item.id] = { quantity: item.quantity, condition: 'sellable' }
                              else delete next[item.id]
                              return next
                            })
                          }
                        />
                      </TableCell>
                    )}
                    <TableCell>{item.product_name}</TableCell>
                    <TableCell align="right">
                      {returnMode && selected[item.id] ? (
                        <TextField
                          type="number"
                          size="small"
                          value={selected[item.id].quantity}
                          onChange={(e) =>
                            setSelected((prev) => ({ ...prev, [item.id]: { ...prev[item.id], quantity: Number(e.target.value) } }))
                          }
                          sx={{ width: 70 }}
                          slotProps={{ htmlInput: { max: item.quantity, min: 1 } }}
                        />
                      ) : (
                        item.quantity
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {currency} {Number(item.line_total).toLocaleString()}
                    </TableCell>
                    {returnMode && (
                      <TableCell>
                        {selected[item.id] && (
                          <TextField
                            select
                            size="small"
                            value={selected[item.id].condition}
                            onChange={(e) =>
                              setSelected((prev) => ({ ...prev, [item.id]: { ...prev[item.id], condition: e.target.value as any } }))
                            }
                            sx={{ width: 110 }}
                          >
                            <MenuItem value="sellable">Sellable</MenuItem>
                            <MenuItem value="damaged">Damaged</MenuItem>
                          </TextField>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {returnMode && (
              <TextField label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} fullWidth size="small" />
            )}

            <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                Total
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {currency} {Number(sale.grand_total).toLocaleString()}
              </Typography>
            </Stack>
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Close</Button>
        {sale?.status === 'completed' && !returnMode && (
          <Button startIcon={<Print />} onClick={() => setReceiptSale(sale)}>
            Print receipt
          </Button>
        )}
        {canReturn && sale?.status === 'completed' && !returnMode && <Button onClick={() => setReturnMode(true)}>Process return</Button>}
        {returnMode && (
          <Button variant="contained" disabled={Object.keys(selected).length === 0} loading={returnMutation.isPending} onClick={() => returnMutation.mutate()}>
            Confirm return
          </Button>
        )}
      </DialogActions>

      <ReceiptDialog sale={receiptSale} onClose={() => setReceiptSale(null)} />
    </Dialog>
  )
}
