import { Email, Print } from '@mui/icons-material'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { useMutation } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { salesApi } from '../../api/endpoints/sales'
import { useToastStore } from '../../stores/toastStore'
import type { Sale } from '../../types'

interface Props {
  sale: Sale | null
  onClose: () => void
}

export function ReceiptDialog({ sale, onClose }: Props) {
  const [paper, setPaper] = useState<'58mm' | '80mm' | 'a4'>('80mm')
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')

  const emailMutation = useMutation({
    mutationFn: () => salesApi.emailReceipt(sale!.id, email || undefined, paper),
    onSuccess: (data) => useToastStore.getState().show(data.message, 'success'),
  })

  useEffect(() => {
    if (!sale) return
    setLoading(true)
    salesApi
      .fetchReceiptPdfBlobUrl(sale.id, paper)
      .then(setBlobUrl)
      .finally(() => setLoading(false))
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sale?.id, paper])

  if (!sale) return null

  return (
    <Dialog open={!!sale} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Receipt {sale.receipt_number}
        <Typography variant="body2" color="text.secondary">
          Change due: {sale.currency} {Number(sale.change_amount).toLocaleString()}
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <TextField select label="Paper size" size="small" value={paper} onChange={(e) => setPaper(e.target.value as any)} sx={{ width: 160 }}>
            <MenuItem value="58mm">58mm thermal</MenuItem>
            <MenuItem value="80mm">80mm thermal</MenuItem>
            <MenuItem value="a4">A4</MenuItem>
          </TextField>
          <TextField
            label="Customer email (optional)"
            size="small"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            sx={{ flexGrow: 1 }}
          />
          <Button
            variant="outlined"
            startIcon={<Email />}
            loading={emailMutation.isPending}
            onClick={() => emailMutation.mutate()}
          >
            Email
          </Button>
        </Stack>
        {blobUrl && (
          <iframe src={blobUrl} title="Receipt" style={{ width: '100%', height: 480, border: '1px solid #e5e7eb', borderRadius: 8 }} />
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Close</Button>
        <Button
          variant="contained"
          startIcon={<Print />}
          disabled={!blobUrl || loading}
          onClick={() => {
            const win = window.open(blobUrl ?? '', '_blank')
            win?.print()
          }}
        >
          Print
        </Button>
      </DialogActions>
    </Dialog>
  )
}
