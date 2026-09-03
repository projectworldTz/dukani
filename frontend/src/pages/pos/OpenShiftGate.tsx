import { Box, Button, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material'
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
  const [branchId, setBranchId] = useState<number | ''>(user?.branch_id ?? '')
  const [openingCash, setOpeningCash] = useState('0')

  const shiftQuery = useQuery({ queryKey: ['shift', 'current'], queryFn: shiftsApi.current })
  const branchesQuery = useQuery({ queryKey: ['branches'], queryFn: branchesApi.list })

  const openMutation = useMutation({
    mutationFn: () => shiftsApi.open(Number(branchId), Number(openingCash)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shift', 'current'] }),
    meta: { successMessage: 'Shift opened.' },
  })

  if (shiftQuery.isLoading || branchesQuery.isLoading) {
    return <Typography sx={{ p: 4 }}>Loading…</Typography>
  }

  if (shiftQuery.data) {
    return <>{children(shiftQuery.data.branch_id, shiftQuery.data.id)}</>
  }

  const assignedBranch = user?.branch_id ? branchesQuery.data?.find((branch) => branch.id === user.branch_id) : null

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 4 }, width: '100%', maxWidth: 380 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }} gutterBottom>
          Open your shift
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Declare your opening cash float before ringing up sales.
        </Typography>
        <Stack spacing={2}>
          {assignedBranch ? (
            <TextField label="Register location" value={assignedBranch.name} slotProps={{ input: { readOnly: true } }} helperText="Your account is assigned to this branch." />
          ) : (
            <TextField select label="Branch" value={branchId} onChange={(e) => setBranchId(Number(e.target.value))}>
              {branchesQuery.data?.map((b) => (
                <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>
              ))}
            </TextField>
          )}
          <TextField
            label="Opening cash"
            type="number"
            value={openingCash}
            onChange={(e) => setOpeningCash(e.target.value)}
            helperText="Enter 0 if the cash drawer starts empty."
          />
          <Button
            variant="contained"
            size="large"
            disabled={!branchId || openingCash === ''}
            loading={openMutation.isPending}
            onClick={() => openMutation.mutate()}
          >
            Open shift
          </Button>
        </Stack>
      </Paper>
    </Box>
  )
}
