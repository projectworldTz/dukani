import { Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Stack, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { Fragment } from 'react'
import { inventoryApi } from '../../api/endpoints/inventory'
import type { Product } from '../../types'
import { formatQty, isWeighed } from '../../utils/quantity'

/** Plain-language names for stock movement types. */
const TYPE_LABELS: Record<string, string> = {
  opening_stock: 'Starting stock',
  purchase: 'Stock received',
  sale: 'Sold',
  sale_return: 'Customer return',
  purchase_return: 'Returned to supplier',
  adjustment: 'Count corrected',
  damaged: 'Damaged',
  expired: 'Expired',
  lost: 'Lost',
  stolen: 'Stolen',
  transfer_in: 'Moved in from another branch',
  transfer_out: 'Moved to another branch',
}

interface Props {
  open: boolean
  product: Product | null
  onClose: () => void
}

export function StockHistoryDialog({ open, product, onClose }: Props) {
  const query = useQuery({
    queryKey: ['stock-movements', product?.id],
    queryFn: () => inventoryApi.movements(product!.id),
    enabled: open && !!product,
  })
  const movements = query.data?.data ?? []

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>
        Stock history
        <Typography variant="body2" color="text.secondary">
          {product?.name}
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        {query.isLoading && <Typography color="text.secondary">Loading…</Typography>}
        {!query.isLoading && movements.length === 0 && (
          <Typography color="text.secondary">No stock changes yet. Use “Add stock” to record items you have.</Typography>
        )}
        <Stack>
          {movements.map((m, i) => (
            <Fragment key={m.id}>
              {i > 0 && <Divider />}
              <Stack direction="row" spacing={2} sx={{ py: 1.5, alignItems: 'center' }}>
                <Chip
                  label={`${m.quantity_change > 0 ? '+' : '−'}${formatQty(Math.abs(m.quantity_change), isWeighed(product))}`}
                  color={m.quantity_change > 0 ? 'success' : 'error'}
                  variant="outlined"
                  sx={{ minWidth: 64, fontWeight: 800 }}
                />
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {TYPE_LABELS[m.type] ?? m.type}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(m.created_at).toLocaleString()}
                    {m.user ? ` · ${m.user.name}` : ''}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                  {formatQty(m.previous_quantity, isWeighed(product))} → <strong>{formatQty(m.new_quantity, isWeighed(product))}</strong>
                </Typography>
              </Stack>
            </Fragment>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
