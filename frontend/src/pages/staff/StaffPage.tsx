import { Add } from '@mui/icons-material'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormGroup,
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { branchesApi } from '../../api/endpoints/branches'
import { rbacApi } from '../../api/endpoints/rbac'
import { staffApi, type StaffPayload } from '../../api/endpoints/staff'

export function StaffPage() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null)
  const [form, setForm] = useState<StaffPayload>({ name: '', email: '', roles: [] })

  const staffQuery = useQuery({ queryKey: ['staff'], queryFn: staffApi.list })
  const branchesQuery = useQuery({ queryKey: ['branches'], queryFn: branchesApi.list })
  const rolesQuery = useQuery({ queryKey: ['roles'], queryFn: rbacApi.roles })

  const createMutation = useMutation({
    mutationFn: () => staffApi.create(form),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      setGeneratedPassword(result.generated_password)
      if (!result.generated_password) {
        closeDialog()
      }
    },
    meta: { successMessage: 'Staff member created.' },
  })

  function closeDialog() {
    setDialogOpen(false)
    setForm({ name: '', email: '', roles: [] })
    setGeneratedPassword(null)
  }

  function toggleRole(roleName: string) {
    setForm((prev) => ({
      ...prev,
      roles: prev.roles.includes(roleName) ? prev.roles.filter((r) => r !== roleName) : [...prev.roles, roleName],
    }))
  }

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' }, mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            Staff
          </Typography>
          <Typography variant="body2" color="text.secondary">
            One account can hold several roles at once — e.g. a single "Seller" with Manager + Cashier + Storekeeper.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => setDialogOpen(true)}>
          Add staff
        </Button>
      </Stack>

      <Paper variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Job title</TableCell>
              <TableCell>Roles</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {staffQuery.data?.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  <Typography sx={{ fontWeight: 600 }}>{member.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {member.email}
                  </Typography>
                </TableCell>
                <TableCell>{member.job_title ?? '—'}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap' }}>
                    {member.roles.map((r) => (
                      <Chip key={r} label={r} size="small" />
                    ))}
                  </Stack>
                </TableCell>
                <TableCell>
                  <Chip label={member.status} size="small" color={member.status === 'active' ? 'success' : 'default'} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="xs" fullWidth>
        <DialogTitle>Add staff member</DialogTitle>
        <DialogContent>
          {generatedPassword ? (
            <Alert severity="success" sx={{ mb: 2 }}>
              Account created. One-time password: <strong>{generatedPassword}</strong> — share this with them now,
              it won't be shown again.
            </Alert>
          ) : (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Staff name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} fullWidth />
              <TextField label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} fullWidth />
              <TextField label="Job title" value={form.job_title ?? ''} onChange={(e) => setForm({ ...form, job_title: e.target.value })} fullWidth />
              <TextField
                select
                label="Branch"
                value={form.branch_id ?? ''}
                onChange={(e) => setForm({ ...form, branch_id: Number(e.target.value) })}
                fullWidth
              >
                {branchesQuery.data?.map((b) => (
                  <MenuItem key={b.id} value={b.id}>
                    {b.name}
                  </MenuItem>
                ))}
              </TextField>

              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                  Roles
                </Typography>
                <FormGroup>
                  {rolesQuery.data
                    ?.filter((r) => !r.is_protected)
                    .map((role) => (
                      <FormControlLabel
                        key={role.id}
                        control={<Checkbox checked={form.roles.includes(role.name)} onChange={() => toggleRole(role.name)} />}
                        label={role.name}
                      />
                    ))}
                </FormGroup>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeDialog}>{generatedPassword ? 'Done' : 'Cancel'}</Button>
          {!generatedPassword && (
            <Button
              variant="contained"
              disabled={!form.name || !form.email || form.roles.length === 0}
              loading={createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              Create
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  )
}
