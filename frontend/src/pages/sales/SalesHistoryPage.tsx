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
import { useSearchParams } from 'react-router-dom'
import { salesApi } from '../../api/endpoints/sales'
import { ReceiptDialog } from '../pos/ReceiptDialog'
import { useAuthStore } from '../../stores/authStore'
import type { Sale } from '../../types'
import { GRAMS_PER_KG, formatQty, kgToGrams } from '../../utils/quantity'

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
  const [searchParams] = useSearchParams()
  const [receiptSearch, setReceiptSearch] = useState(searchParams.get('receipt') ?? '')

  const salesQuery = useQuery({
    queryKey: ['sales', 'history', receiptSearch],
    queryFn: () => salesApi.list({ status: receiptSearch ? undefined : 'completed', receipt_number: receiptSearch || undefined }),
  })

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>
        Sales History
      </Typography>
      <TextField
        placeholder="Find a sale by receipt number…"
        value={receiptSearch}
        onChange={(e) => setReceiptSearch(e.target.value)}
        size="small"
        fullWidth
        sx={{ mb: 2, maxWidth: 420, bgcolor: 'background.paper' }}
      />

      {/* Phones: one tappable row per sale, like a payments app. */}
      <Paper variant="outlined" sx={{ display: { xs: 'block', sm: 'none' }, borderRadius: '14px', overflow: 'hidden' }}>
        {salesQuery.data?.data?.length === 0 && (
          <Typography color="text.secondary" sx={{ p: 3, textAlign: 'center' }}>
            No sales found.
          </Typography>
        )}
        {salesQuery.data?.data?.map((s: Sale & { cashier?: { name: string } }, i: number) => (
          <Box
            key={s.id}
            onClick={() => setDetailId(s.id)}
            sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5, cursor: 'pointer', borderTop: i === 0 ? 0 : '1px solid', borderColor: 'divider', '&:active': { bgcolor: 'action.hover' } }}
          >
            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 15 }} noWrap>
                Sale #{Number(s.receipt_number.split('-').pop()) || s.receipt_number}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap component="div">
                {new Date(s.completed_at ?? s.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                {s.cashier?.name ? ` · ${s.cashier.name}` : ''}
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
              <Typography sx={{ fontWeight: 800, fontSize: 15, whiteSpace: 'nowrap' }}>
                {currency} {Number(s.grand_total).toLocaleString()}
              </Typography>
              <Chip label={s.status.replace('_', ' ')} size="small" color={STATUS_COLORS[s.status] ?? 'default'} sx={{ height: 20, fontSize: 11, textTransform: 'capitalize' }} />
            </Box>
          </Box>
        ))}
      </Paper>

      <Paper variant="outlined" sx={{ display: { xs: 'none', sm: 'block' } }}>
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
                          value={(item.price_divisor ?? 1) > 1 ? selected[item.id].quantity / GRAMS_PER_KG : selected[item.id].quantity}
                          onChange={(e) =>
                            setSelected((prev) => ({
                              ...prev,
                              // Weighed lines are returned in kg (stored as grams).
                              [item.id]: { ...prev[item.id], quantity: (item.price_divisor ?? 1) > 1 ? (kgToGrams(e.target.value) ?? 0) : Number(e.target.value) },
                            }))
                          }
                          sx={{ width: (item.price_divisor ?? 1) > 1 ? 100 : 70 }}
                          slotProps={(item.price_divisor ?? 1) > 1 ? { htmlInput: { max: item.quantity / GRAMS_PER_KG, min: 0.001, step: 0.001 }, input: { endAdornment: <span style={{ fontSize: 12, marginLeft: 4 }}>kg</span> } } : { htmlInput: { max: item.quantity, min: 1 } }}
                        />
                      ) : (
                        formatQty(item.quantity, (item.price_divisor ?? 1) > 1)
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
