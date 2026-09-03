import { Email, ExpandMore, Print } from '@mui/icons-material'
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { useMutation } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { salesApi } from '../../api/endpoints/sales'
import { useToastStore } from '../../stores/toastStore'
import type { Sale } from '../../types'

interface Props {
  sale: Sale | null
  onClose: () => void
  onFiscalized?: (sale: Sale) => void
}

export function ReceiptDialog({ sale, onClose, onFiscalized }: Props) {
  const saleId = sale?.id
  const [paper, setPaper] = useState<'58mm' | '80mm' | 'a4'>('80mm')
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [showOptions, setShowOptions] = useState(false)

  const emailMutation = useMutation({
    mutationFn: () => salesApi.emailReceipt(sale!.id, email || undefined, paper),
    onSuccess: (data) => useToastStore.getState().show(data.message, 'success'),
  })
  const fiscalizeMutation = useMutation({
    mutationFn: () => salesApi.fiscalize(sale!.id),
    onSuccess: (updatedSale) => {
      onFiscalized?.(updatedSale)
      useToastStore.getState().show('EFD receipt generated successfully.', 'success')
    },
    onError: () => useToastStore.getState().show('EFD is still unavailable. The sale remains safely recorded.', 'error'),
  })

  useEffect(() => {
    if (!saleId) return
    let currentUrl: string | null = null
    salesApi
      .fetchReceiptPdfBlobUrl(saleId, paper)
      .then((url) => {
        currentUrl = url
        setBlobUrl(url)
      })
      .finally(() => setLoading(false))
    return () => {
      if (currentUrl) URL.revokeObjectURL(currentUrl)
    }
  }, [saleId, paper])

  if (!sale) return null

  return (
    <Dialog open={!!sale} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Sale completed</DialogTitle>
      <DialogContent>
        <Alert severity="success" sx={{ mb: 2 }}>
          Receipt <strong>{sale.receipt_number}</strong> has been recorded successfully.
        </Alert>
        {sale.fiscal_status === 'failed' && (
          <Alert severity="warning" sx={{ mb: 2 }} action={
            <Button color="inherit" size="small" loading={fiscalizeMutation.isPending} onClick={() => fiscalizeMutation.mutate()}>
              Retry EFD
            </Button>
          }>The sale was saved, but the EFD gateway did not fiscalize it. This printout is marked non-fiscal; retry before issuing it as a tax receipt.</Alert>
        )}
        {sale.fiscal_status === 'fiscalized' && (
          <Alert severity="info" sx={{ mb: 2 }}>TRA fiscal receipt {sale.fiscal_receipt_number} · verification {sale.fiscal_verification_code}</Alert>
        )}
        <Typography variant="body2" color="text.secondary">Change due</Typography>
        <Typography variant="h3" sx={{ fontWeight: 850, mb: 2, fontSize: { xs: '2rem', sm: '3rem' }, overflowWrap: 'anywhere' }}>{sale.currency} {Number(sale.change_amount).toLocaleString()}</Typography>

        <Button endIcon={<ExpandMore />} size="small" onClick={() => setShowOptions((shown) => !shown)}>
          {showOptions ? 'Hide receipt options' : 'More receipt options'}
        </Button>
        {showOptions && (
          <Stack spacing={1.5} sx={{ mt: 1.5 }}>
            <TextField select label="Paper size" size="small" value={paper} onChange={(e) => {
              setLoading(true)
              setPaper(e.target.value as '58mm' | '80mm' | 'a4')
            }} sx={{ width: { xs: '100%', sm: 180 } }}>
              <MenuItem value="58mm">58mm thermal</MenuItem>
              <MenuItem value="80mm">80mm thermal</MenuItem>
              <MenuItem value="a4">A4</MenuItem>
            </TextField>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField label="Customer email" size="small" type="email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth />
              <Button variant="outlined" startIcon={<Email />} disabled={!email} loading={emailMutation.isPending} onClick={() => emailMutation.mutate()}>Email</Button>
            </Stack>
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: { xs: 2, sm: 3 }, pb: 2, '& > button': { flex: { xs: '1 1 100%', sm: '0 0 auto' } } }}>
        <Button onClick={onClose}>No receipt · New sale</Button>
        <Button
          variant="contained"
          size="large"
          startIcon={<Print />}
          disabled={!blobUrl || loading}
          onClick={() => {
            const win = window.open(blobUrl ?? '', '_blank')
            win?.print()
            onClose()
          }}
        >
          Print · New sale
        </Button>
      </DialogActions>
    </Dialog>
  )
}
