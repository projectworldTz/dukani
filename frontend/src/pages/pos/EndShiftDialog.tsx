import { CheckCircle, Warning } from '@mui/icons-material'
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, InputAdornment, Stack, TextField, Typography } from '@mui/material'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { shiftsApi } from '../../api/endpoints/shifts'
import { useAuthStore } from '../../stores/authStore'
import type { CashierShift } from '../../types'
import { money } from './posUtils'

interface Props {
  open: boolean
  shiftId: number
  onClose: () => void
}

/** Cash-up at the end of the day: count the drawer, see whether it matches what the system expected. */
export function EndShiftDialog({ open, shiftId, onClose }: Props) {
  const queryClient = useQueryClient()
  const currency = useAuthStore((s) => s.user?.business?.currency ?? '')
  const [closingCash, setClosingCash] = useState('')
  const [notes, setNotes] = useState('')
  const [result, setResult] = useState<CashierShift | null>(null)

  const mutation = useMutation({
    mutationFn: () => shiftsApi.close(shiftId, Number(closingCash), notes || undefined),
    onSuccess: (shift) => setResult(shift),
  })

  function finish() {
    setResult(null)
    setClosingCash('')
    setNotes('')
    onClose()
    queryClient.invalidateQueries({ queryKey: ['shift', 'current'] })
  }

  const difference = Number(result?.difference ?? 0)

  return (
    <Dialog open={open} onClose={result ? finish : mutation.isPending ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>{result ? 'Shift closed' : 'End your shift'}</DialogTitle>
      <DialogContent>
        {result ? (
          <Stack spacing={2}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              {difference === 0 ? <CheckCircle color="success" sx={{ fontSize: 40 }} /> : <Warning color="warning" sx={{ fontSize: 40 }} />}
              <Typography sx={{ fontWeight: 700 }}>
                {difference === 0 ? 'Your cash matches perfectly.' : difference > 0 ? 'There is more cash than expected.' : 'There is less cash than expected.'}
              </Typography>
            </Stack>
            <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'grey.50', border: '1px solid', borderColor: 'divider' }}>
              {[
                ['Expected in drawer', Number(result.expected_cash ?? 0)],
                ['You counted', Number(result.closing_cash ?? 0)],
              ].map(([label, value]) => (
                <Stack key={label as string} direction="row" sx={{ justifyContent: 'space-between', py: 0.5 }}>
                  <Typography color="text.secondary">{label}</Typography>
                  <Typography sx={{ fontWeight: 600 }}>{currency} {money(value as number)}</Typography>
                </Stack>
              ))}
              <Stack direction="row" sx={{ justifyContent: 'space-between', pt: 1, mt: 0.5, borderTop: '1px solid', borderColor: 'divider' }}>
                <Typography sx={{ fontWeight: 700 }}>Difference</Typography>
                <Typography sx={{ fontWeight: 800, color: difference === 0 ? 'success.main' : difference > 0 ? 'info.main' : 'error.main' }}>
                  {difference > 0 ? '+' : ''}
                  {currency} {money(difference)}
                </Typography>
              </Stack>
            </Box>
          </Stack>
        ) : (
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography color="text.secondary">Count all the cash in your drawer and enter the total. We will compare it with today's cash sales.</Typography>
            <TextField
              label="Cash in drawer now"
              type="number"
              value={closingCash}
              onChange={(e) => setClosingCash(e.target.value)}
              autoFocus
              fullWidth
              slotProps={{ input: { startAdornment: <InputAdornment position="start">{currency}</InputAdornment> }, htmlInput: { min: 0 } }}
            />
            <TextField label="Note (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} multiline minRows={2} fullWidth placeholder="e.g. Paid 2,000 for transport from the drawer" />
            <Alert severity="info">After closing, you'll need to start a new shift to sell again.</Alert>
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        {result ? (
          <Button variant="contained" size="large" onClick={finish} fullWidth>
            Done
          </Button>
        ) : (
          <>
            <Button onClick={onClose} disabled={mutation.isPending}>
              Keep selling
            </Button>
            <Button variant="contained" size="large" disabled={closingCash === ''} loading={mutation.isPending} onClick={() => mutation.mutate()}>
              Close shift
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}
