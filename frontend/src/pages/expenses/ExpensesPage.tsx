import { Add } from '@mui/icons-material'
import {
  Box,
  Button,
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
import { expenseCategoriesApi, expensesApi } from '../../api/endpoints/expenses'
import { useAuthStore } from '../../stores/authStore'

export function ExpensesPage() {
  const queryClient = useQueryClient()
  const currency = useAuthStore((s) => s.user?.business?.currency ?? '')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [newCategoryName, setNewCategoryName] = useState('')

  const expensesQuery = useQuery({ queryKey: ['expenses'], queryFn: () => expensesApi.list() })
  const categoriesQuery = useQuery({ queryKey: ['expense-categories'], queryFn: expenseCategoriesApi.list })

  const createCategoryMutation = useMutation({
    mutationFn: () => expenseCategoriesApi.create(newCategoryName),
    onSuccess: (category: any) => {
      queryClient.invalidateQueries({ queryKey: ['expense-categories'] })
      setCategoryId(category.id)
      setNewCategoryName('')
    },
    meta: { successMessage: 'Category added.' },
  })

  const createMutation = useMutation({
    mutationFn: () => expensesApi.create({ expense_category_id: Number(categoryId), amount: Number(amount), description, date }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      setDialogOpen(false)
      setAmount('')
      setDescription('')
    },
    meta: { successMessage: 'Expense recorded.' },
  })

  return (
    <Box>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          Expenses
        </Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => setDialogOpen(true)}>
          Record expense
        </Button>
      </Stack>

      <Paper variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Description</TableCell>
              <TableCell align="right">Amount</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {expensesQuery.data?.data?.map((e: any) => (
              <TableRow key={e.id}>
                <TableCell>{e.date}</TableCell>
                <TableCell>{e.category?.name}</TableCell>
                <TableCell>{e.description ?? '—'}</TableCell>
                <TableCell align="right">
                  {currency} {Number(e.amount).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Record expense</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction="row" spacing={1}>
              <TextField select label="Category" value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))} fullWidth>
                {categoriesQuery.data?.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
            <Stack direction="row" spacing={1}>
              <TextField
                size="small"
                label="New category"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                fullWidth
              />
              <Button
                size="small"
                disabled={!newCategoryName}
                loading={createCategoryMutation.isPending}
                onClick={() => createCategoryMutation.mutate()}
              >
                Add
              </Button>
            </Stack>
            <TextField label="Amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} fullWidth />
            <TextField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} fullWidth />
            <TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth multiline rows={2} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!categoryId || !amount} loading={createMutation.isPending} onClick={() => createMutation.mutate()}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
