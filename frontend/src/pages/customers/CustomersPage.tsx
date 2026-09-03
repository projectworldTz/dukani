import { Add } from '@mui/icons-material'
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import { customersApi, type CustomerRecord } from '../../api/endpoints/customers'
import { useAuthStore } from '../../stores/authStore'

export function CustomersPage() {
  const queryClient = useQueryClient()
  const currency = useAuthStore((s) => s.user?.business?.currency ?? '')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<Partial<CustomerRecord>>({ customer_type: 'retail', credit_limit: 0 })

  const customersQuery = useQuery({ queryKey: ['customers'], queryFn: () => customersApi.list() })

  const createMutation = useMutation({
    mutationFn: () => customersApi.create(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      setDialogOpen(false)
      setForm({ customer_type: 'retail', credit_limit: 0 })
    },
    meta: { successMessage: 'Customer added.' },
  })

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' }, mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          Customers
        </Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => setDialogOpen(true)}>
          Add customer
        </Button>
      </Stack>

      <Paper variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Phone</TableCell>
              <TableCell>Type</TableCell>
              <TableCell align="right">Loyalty points</TableCell>
              <TableCell align="right">Credit limit</TableCell>
              <TableCell align="right">Outstanding</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {customersQuery.data?.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{c.name}</TableCell>
                <TableCell>{c.phone ?? '—'}</TableCell>
                <TableCell>
                  <Chip label={c.customer_type} size="small" variant="outlined" />
                </TableCell>
                <TableCell align="right">{c.loyalty_points}</TableCell>
                <TableCell align="right">
                  {currency} {Number(c.credit_limit).toLocaleString()}
                </TableCell>
                <TableCell align="right">
                  {c.outstanding_balance > 0 ? (
                    <Chip label={`${currency} ${c.outstanding_balance.toLocaleString()}`} size="small" color="warning" />
                  ) : (
                    '—'
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add customer</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Name" value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} fullWidth />
            <TextField label="Phone" value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} fullWidth />
            <TextField label="Email" value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} fullWidth />
            <TextField
              select
              label="Customer type"
              value={form.customer_type ?? 'retail'}
              onChange={(e) => setForm({ ...form, customer_type: e.target.value as 'retail' | 'wholesale' })}
              fullWidth
            >
              <MenuItem value="retail">Retail</MenuItem>
              <MenuItem value="wholesale">Wholesale</MenuItem>
            </TextField>
            <TextField
              label="Credit limit"
              type="number"
              value={form.credit_limit ?? 0}
              onChange={(e) => setForm({ ...form, credit_limit: Number(e.target.value) })}
              fullWidth
              helperText="Maximum amount this customer may owe on credit sales"
            />
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
