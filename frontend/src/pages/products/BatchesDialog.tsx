import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Skeleton, Stack, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { expiryStatus, medicineSubtitle, pharmacyApi } from '../../api/endpoints/pharmacy'
import type { Product } from '../../types'

/** Every batch of a medicine on the shelf, nearest expiry first — the order they will be sold in. */
export function BatchesDialog({ product, branchId, onClose }: { product: Product | null; branchId: number | null; onClose: () => void }) {
  const query = useQuery({
    queryKey: ['pharmacy', 'batches', product?.id, branchId],
    queryFn: () => pharmacyApi.productBatches(product!.id, branchId ?? undefined),
    enabled: !!product,
  })
  const batches = query.data ?? []
  const tracked = batches.reduce((sum, b) => sum + b.quantity_remaining, 0)
  const untracked = Math.max(0, (product?.available_stock ?? 0) - tracked)

  return (
    <Dialog open={!!product} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>
        Batches & expiry dates
        <Typography variant="body2" color="text.secondary">
          {product?.name}
          {product && medicineSubtitle(product) ? ` · ${medicineSubtitle(product)}` : ''}
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Sales always take from the batch that expires first. Expired batches can't be sold — remove them from stock.
        </Typography>
        {query.isLoading && <Skeleton variant="rounded" height={120} />}
        {query.isSuccess && batches.length === 0 && untracked === 0 && (
          <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
            No stock on the shelf. Use “Receive” to add a batch.
          </Typography>
        )}
        <Stack spacing={1}>
          {batches.map((b, i) => {
            const status = expiryStatus(b.expiry_date)
            return (
              <Stack
                key={b.id}
                direction="row"
                spacing={1.5}
                sx={{ alignItems: 'center', p: 1.5, borderRadius: 2, border: '1px solid', borderColor: b.is_expired ? 'error.light' : 'divider', bgcolor: b.is_expired ? '#FEF2F2' : 'background.paper' }}
              >
                <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                  <Typography component="div" sx={{ fontWeight: 700 }}>
                    Batch {b.batch_number}
                    {i === 0 && !b.is_expired && <Chip label="Sells next" size="small" color="primary" sx={{ ml: 1, height: 20, fontSize: 11 }} />}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Received {b.quantity_received}
                    {b.manufactured_at ? ` · made ${new Date(b.manufactured_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}` : ''}
                  </Typography>
                </Box>
                <Chip label={status.label} size="small" color={status.color} variant={status.color === 'success' ? 'outlined' : 'filled'} />
                <Typography sx={{ fontWeight: 800, minWidth: 48, textAlign: 'right' }}>{b.quantity_remaining}</Typography>
              </Stack>
            )
          })}
          {untracked > 0 && (
            <Alert severity="info">
              {untracked} unit(s) were in stock before batch tracking started. They will be sold after the batches above.
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
