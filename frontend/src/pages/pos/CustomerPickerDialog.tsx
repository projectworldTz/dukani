import { PersonAdd, PersonOutlined, Search } from '@mui/icons-material'
import {
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  InputAdornment,
  List,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useDeferredValue, useState } from 'react'
import { customersApi, type CustomerRecord } from '../../api/endpoints/customers'
import { useAuthStore } from '../../stores/authStore'

interface Props {
  open: boolean
  onClose: () => void
  onSelect: (customer: CustomerRecord | null) => void
}

/**
 * Customers are optional: the default is "Walk-in". This dialog finds an existing
 * customer or registers a new one with just a name and phone, without leaving the sale.
 */
export function CustomerPickerDialog({ open, onClose, onSelect }: Props) {
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))
  const queryClient = useQueryClient()
  const currency = useAuthStore((s) => s.user?.business?.currency ?? '')
  const canCreate = useAuthStore((s) => s.hasPermission('customers.manage'))
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const deferredSearch = useDeferredValue(search)

  const customersQuery = useQuery({
    queryKey: ['customers', 'pos-search', deferredSearch],
    queryFn: () => customersApi.list(deferredSearch || undefined),
    enabled: open,
  })

  const createMutation = useMutation({
    mutationFn: () => customersApi.create({ name: name.trim(), phone: phone.trim() || null }),
    onSuccess: (customer) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      choose(customer)
    },
    meta: { successMessage: 'Customer added.' },
  })

  function reset() {
    setSearch('')
    setCreating(false)
    setName('')
    setPhone('')
  }

  function choose(customer: CustomerRecord | null) {
    onSelect(customer)
    reset()
    onClose()
  }

  const customers = customersQuery.data ?? []

  return (
    <Dialog open={open} onClose={() => { reset(); onClose() }} maxWidth="xs" fullWidth fullScreen={fullScreen}>
      <DialogTitle sx={{ fontWeight: 800 }}>{creating ? 'New customer' : 'Who is buying?'}</DialogTitle>
      <DialogContent>
        {creating ? (
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Customer name" value={name} onChange={(e) => setName(e.target.value)} autoFocus fullWidth required />
            <TextField label="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 0712 345 678" fullWidth />
            <Typography variant="body2" color="text.secondary">
              Saving the customer lets you track their purchases, give credit and loyalty points.
            </Typography>
          </Stack>
        ) : (
          <>
            <Button
              fullWidth
              variant="outlined"
              size="large"
              startIcon={<PersonOutlined />}
              onClick={() => choose(null)}
              sx={{ justifyContent: 'flex-start', mt: 1, mb: 2, py: 1.25 }}
            >
              Walk-in customer (no name needed)
            </Button>
            <TextField
              placeholder="Search by name or phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              fullWidth
              size="small"
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search /></InputAdornment> } }}
            />
            <List sx={{ mt: 1, maxHeight: { sm: 320 }, overflowY: 'auto' }}>
              {customers.map((c) => (
                <ListItemButton key={c.id} onClick={() => choose(c)} sx={{ borderRadius: 2 }}>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: 'primary.main' }}>{c.name[0]?.toUpperCase()}</Avatar>
                  </ListItemAvatar>
                  <ListItemText primary={c.name} secondary={c.phone ?? 'No phone'} slotProps={{ primary: { sx: { fontWeight: 600 } } }} />
                  <Stack spacing={0.5} sx={{ alignItems: 'flex-end' }}>
                    {c.loyalty_points > 0 && <Chip size="small" label={`${c.loyalty_points} pts`} color="success" variant="outlined" />}
                    {Number(c.outstanding_balance) > 0 && (
                      <Chip size="small" label={`Owes ${currency} ${Number(c.outstanding_balance).toLocaleString()}`} color="warning" variant="outlined" />
                    )}
                  </Stack>
                </ListItemButton>
              ))}
              {customersQuery.isSuccess && customers.length === 0 && (
                <Box sx={{ py: 3, textAlign: 'center' }}>
                  <Typography color="text.secondary">{search ? `No customer matches “${search}”.` : 'No customers saved yet.'}</Typography>
                </Box>
              )}
            </List>
          </>
        )}
      </DialogContent>
      <Divider />
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        {creating ? (
          <>
            <Button onClick={() => setCreating(false)}>Back</Button>
            <Button variant="contained" disabled={!name.trim()} loading={createMutation.isPending} onClick={() => createMutation.mutate()}>
              Save & use customer
            </Button>
          </>
        ) : (
          <>
            <Button onClick={() => { reset(); onClose() }}>Cancel</Button>
            {canCreate && (
              <Button
                variant="contained"
                startIcon={<PersonAdd />}
                onClick={() => {
                  setCreating(true)
                  // Pre-fill whichever field the cashier already typed in the search box.
                  if (/^[\d\s+]+$/.test(search)) setPhone(search)
                  else setName(search)
                }}
              >
                New customer
              </Button>
            )}
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}
