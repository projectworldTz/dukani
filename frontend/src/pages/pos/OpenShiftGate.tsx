import { PointOfSale } from '@mui/icons-material'
import { Box, Button, CircularProgress, InputAdornment, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { branchesApi } from '../../api/endpoints/branches'
import { shiftsApi } from '../../api/endpoints/shifts'
import { useAuthStore } from '../../stores/authStore'

/** Gates the POS screen behind an open cashier shift — spec §28: sell only after
 * opening a shift with a declared opening cash float. */
export function OpenShiftGate({ children }: { children: (branchId: number, shiftId: number) => ReactNode }) {
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const currency = user?.business?.currency ?? ''
  const [pickedBranchId, setPickedBranchId] = useState<number | ''>('')
  const [openingCash, setOpeningCash] = useState('')

  const shiftQuery = useQuery({ queryKey: ['shift', 'current'], queryFn: shiftsApi.current })
  const branchesQuery = useQuery({ queryKey: ['branches'], queryFn: branchesApi.list })
  const branches = branchesQuery.data ?? []

  // Single-branch shops (and staff tied to one branch) never have to choose.
  const autoBranchId = user?.branch_id ?? (branches.length === 1 ? branches[0].id : null)
  const branchId = autoBranchId ?? pickedBranchId

  const openMutation = useMutation({
    mutationFn: () => shiftsApi.open(Number(branchId), Number(openingCash || 0)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shift', 'current'] }),
    meta: { successMessage: 'Shift started — happy selling!' },
  })

  if (shiftQuery.isLoading || branchesQuery.isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2, py: 10 }}>
        <CircularProgress size={28} />
        <Typography color="text.secondary">Getting the till ready…</Typography>
      </Box>
    )
  }

  if (shiftQuery.data?.id) {
    return <>{children(shiftQuery.data.branch_id, shiftQuery.data.id)}</>
  }

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: { xs: 3, sm: 8 } }}>
      <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 }, width: '100%', maxWidth: 420, borderRadius: 4, textAlign: 'center' }}>
        <Box sx={{ width: 64, height: 64, mx: 'auto', mb: 2, borderRadius: '50%', bgcolor: '#DBEAFE', color: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <PointOfSale sx={{ fontSize: 32 }} />
        </Box>
        <Typography variant="h5" sx={{ fontWeight: 800 }} gutterBottom>
          Start your shift
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          How much cash is in the drawer right now? At the end of the day we'll help you check it adds up.
        </Typography>
        <Stack spacing={2} sx={{ textAlign: 'left' }}>
          {!autoBranchId && (
            <TextField select label="Which branch are you selling at?" value={pickedBranchId} onChange={(e) => setPickedBranchId(Number(e.target.value))}>
              {branches.map((b) => (
                <MenuItem key={b.id} value={b.id}>
                  {b.name}
                </MenuItem>
              ))}
            </TextField>
          )}
          <TextField
            label="Cash in drawer"
            type="number"
            value={openingCash}
            placeholder="0"
            autoFocus
            onChange={(e) => setOpeningCash(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && branchId) openMutation.mutate()
            }}
            helperText="Leave empty if the drawer is empty."
            slotProps={{ input: { startAdornment: <InputAdornment position="start">{currency}</InputAdornment> }, htmlInput: { min: 0 } }}
          />
          <Button variant="contained" size="large" disabled={!branchId} loading={openMutation.isPending} onClick={() => openMutation.mutate()} sx={{ py: 1.5, fontSize: 16 }}>
            Start selling
          </Button>
        </Stack>
      </Paper>
    </Box>
  )
}
