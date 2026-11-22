import { CheckCircleRounded, Email, ExpandLess, ExpandMore, Print } from '@mui/icons-material'
import { Alert, Box, Button, Collapse, Dialog, DialogActions, DialogContent, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { useMutation } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { salesApi } from '../../api/endpoints/sales'
import { useToastStore } from '../../stores/toastStore'
import type { Sale } from '../../types'
import { money } from './posUtils'

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

  const change = Number(sale.change_amount)
  const owed = Number(sale.outstanding_balance ?? 0)

  return (
    <Dialog open={!!sale} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogContent sx={{ textAlign: 'center', pt: 4 }}>
        <CheckCircleRounded color="success" sx={{ fontSize: 72 }} />
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          Sale complete
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2.5 }}>
          Receipt {sale.receipt_number} · {sale.currency} {money(Number(sale.grand_total))}
        </Typography>

        {change > 0 && (
          <Box sx={{ p: 2, mb: 2, borderRadius: 3, bgcolor: '#ECFDF5', border: '1px solid', borderColor: 'success.light' }}>
            <Typography variant="body2" color="success.dark" sx={{ fontWeight: 600 }}>
              Give change
            </Typography>
            <Typography sx={{ fontWeight: 850, fontSize: '2.4rem', color: 'success.dark', lineHeight: 1.15 }}>
              {sale.currency} {money(change)}
            </Typography>
          </Box>
        )}
        {owed > 0 && (
          <Alert severity="info" sx={{ mb: 2, textAlign: 'left' }}>
            {sale.currency} {money(owed)} was added to {sale.customer_name ?? 'the customer'}'s account.
          </Alert>
        )}
        {sale.loyalty_points_earned ? (
          <Typography variant="body2" color="success.main" sx={{ mb: 2, fontWeight: 600 }}>
            Customer earned {sale.loyalty_points_earned} loyalty point{sale.loyalty_points_earned === 1 ? '' : 's'}.
          </Typography>
        ) : null}

        {sale.fiscal_status === 'failed' && (
          <Alert
            severity="warning"
            sx={{ mb: 2, textAlign: 'left' }}
            action={
              <Button color="inherit" size="small" loading={fiscalizeMutation.isPending} onClick={() => fiscalizeMutation.mutate()}>
                Retry EFD
              </Button>
            }
          >
            The sale was saved, but the EFD gateway did not fiscalize it. This printout is marked non-fiscal; retry before issuing it as a tax receipt.
          </Alert>
        )}
        {sale.fiscal_status === 'fiscalized' && (
          <Alert severity="info" sx={{ mb: 2, textAlign: 'left' }}>
            TRA fiscal receipt {sale.fiscal_receipt_number} · verification {sale.fiscal_verification_code}
          </Alert>
        )}

        <Button size="small" endIcon={showOptions ? <ExpandLess /> : <ExpandMore />} onClick={() => setShowOptions((shown) => !shown)}>
          Email receipt or change paper size
        </Button>
        <Collapse in={showOptions}>
          <Stack spacing={1.5} sx={{ mt: 1.5, textAlign: 'left' }}>
            <TextField
              select
              label="Paper size"
              size="small"
              value={paper}
              onChange={(e) => {
                setLoading(true)
                setPaper(e.target.value as '58mm' | '80mm' | 'a4')
              }}
            >
              <MenuItem value="58mm">58mm receipt printer</MenuItem>
              <MenuItem value="80mm">80mm receipt printer</MenuItem>
              <MenuItem value="a4">A4 paper</MenuItem>
            </TextField>
            <Stack direction="row" spacing={1}>
              <TextField label="Customer email" size="small" type="email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth />
              <Button variant="outlined" startIcon={<Email />} disabled={!email} loading={emailMutation.isPending} onClick={() => emailMutation.mutate()}>
                Send
              </Button>
            </Stack>
          </Stack>
        </Collapse>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3, flexDirection: 'column', gap: 1, '& > :not(style) ~ :not(style)': { ml: 0 } }}>
        <Button
          variant="contained"
          size="large"
          fullWidth
          startIcon={<Print />}
          disabled={!blobUrl || loading}
          onClick={() => {
            const win = window.open(blobUrl ?? '', '_blank')
            win?.print()
            onClose()
          }}
          sx={{ py: 1.25, fontSize: 16 }}
        >
          Print receipt
        </Button>
        <Button variant="outlined" size="large" fullWidth onClick={onClose} autoFocus sx={{ py: 1.25, fontSize: 16 }}>
          New sale (no receipt)
        </Button>
      </DialogActions>
    </Dialog>
  )
}
