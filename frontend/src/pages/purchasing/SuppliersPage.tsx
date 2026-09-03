import { Add } from '@mui/icons-material'
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import { suppliersApi, type SupplierRecord } from '../../api/endpoints/purchasing'
import { useAuthStore } from '../../stores/authStore'

export function SuppliersPage() {
  const queryClient = useQueryClient()
  const currency = useAuthStore((s) => s.user?.business?.currency ?? '')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<Partial<SupplierRecord>>({})

  const suppliersQuery = useQuery({ queryKey: ['suppliers'], queryFn: suppliersApi.list })

  const createMutation = useMutation({
    mutationFn: () => suppliersApi.create(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      setDialogOpen(false)
      setForm({})
    },
    meta: { successMessage: 'Supplier added.' },
  })

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' }, mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          Suppliers
        </Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => setDialogOpen(true)}>
          Add supplier
        </Button>
      </Stack>

      <Paper variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Contact</TableCell>
              <TableCell>Phone</TableCell>
              <TableCell align="right">Outstanding balance</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {suppliersQuery.data?.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.name}</TableCell>
                <TableCell>{s.contact_person ?? '—'}</TableCell>
                <TableCell>{s.phone ?? '—'}</TableCell>
                <TableCell align="right">
                  {s.outstanding_balance > 0 ? (
                    <Chip label={`${currency} ${s.outstanding_balance.toLocaleString()}`} size="small" color="warning" />
                  ) : (
                    <Chip label="Settled" size="small" color="success" variant="outlined" />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add supplier</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Name" value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} fullWidth />
            <TextField
              label="Contact person"
              value={form.contact_person ?? ''}
              onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
              fullWidth
            />
            <TextField label="Phone" value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} fullWidth />
            <TextField label="Email" value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} fullWidth />
            <TextField label="TIN" value={form.tin ?? ''} onChange={(e) => setForm({ ...form, tin: e.target.value })} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!form.name} loading={createMutation.isPending} onClick={() => createMutation.mutate()}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
