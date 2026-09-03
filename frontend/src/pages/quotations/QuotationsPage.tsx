import { Add, ContentCopy, Delete, Download, Edit, MoreVert, Print, Share, SwapHoriz } from '@mui/icons-material'
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
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
import { useNavigate } from 'react-router-dom'
import { branchesApi } from '../../api/endpoints/branches'
import { customersApi } from '../../api/endpoints/customers'
import { productsApi } from '../../api/endpoints/products'
import { quotationsApi, type QuotationItemPayload } from '../../api/endpoints/quotations'
import { useAuthStore } from '../../stores/authStore'
import { useToastStore } from '../../stores/toastStore'

const STATUS_COLORS: Record<string, 'default' | 'info' | 'success' | 'error' | 'warning'> = {
  draft: 'default',
  sent: 'info',
  accepted: 'success',
  rejected: 'error',
  expired: 'warning',
  converted: 'success',
}

const EMPTY_FORM = {
  branchId: '' as number | '',
  customerId: '' as number | '',
  customerName: '',
  validUntil: '',
  notes: '',
  paymentTerms: '',
  lines: [] as QuotationItemPayload[],
}

function pdfFileName(number: string) {
  return `${number}.pdf`
}

async function sharePdf(blob: Blob, fileName: string) {
  const file = new File([blob], fileName, { type: 'application/pdf' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName })
    } catch {
      // User cancelled the share sheet — not an error worth surfacing.
    }
    return
  }
  downloadPdf(blob, fileName)
  useToastStore.getState().show('Sharing is not supported on this browser — downloaded the PDF instead.', 'info')
}

function downloadPdf(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

function printPdf(blob: Blob) {
  const url = URL.createObjectURL(blob)
  const win = window.open(url, '_blank')
  win?.addEventListener('load', () => win.print())
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export function QuotationsPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const currency = useAuthStore((s) => s.user?.business?.currency ?? '')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; quotation: any } | null>(null)

  const quotationsQuery = useQuery({ queryKey: ['quotations'], queryFn: () => quotationsApi.list() })
  const branchesQuery = useQuery({ queryKey: ['branches'], queryFn: branchesApi.list })
  const customersQuery = useQuery({ queryKey: ['customers'], queryFn: () => customersApi.list() })
  const productsQuery = useQuery({ queryKey: ['products', 'all'], queryFn: () => productsApi.list({ status: 'active' }) })

  function closeDialog() {
    setDialogOpen(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  async function openEdit(id: number) {
    setMenuAnchor(null)
    const q = await quotationsApi.show(id)
    setEditingId(id)
    setForm({
      branchId: q.branch_id,
      customerId: q.customer_id ?? '',
      customerName: q.customer_name ?? '',
      validUntil: q.valid_until ? String(q.valid_until).slice(0, 10) : '',
      notes: q.notes ?? '',
      paymentTerms: q.payment_terms ?? '',
      lines: q.items.map((item: any) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: Number(item.unit_price),
        discount_amount: Number(item.discount_amount) || undefined,
      })),
    })
    setDialogOpen(true)
  }

  const createMutation = useMutation({
    mutationFn: () =>
      quotationsApi.create({
        branch_id: Number(form.branchId),
        customer_id: form.customerId ? Number(form.customerId) : undefined,
        customer_name: form.customerName || undefined,
        valid_until: form.validUntil || undefined,
        notes: form.notes || undefined,
        payment_terms: form.paymentTerms || undefined,
        items: form.lines,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] })
      closeDialog()
    },
    meta: { successMessage: 'Quotation created.' },
  })

  const updateMutation = useMutation({
    mutationFn: () =>
      quotationsApi.update(editingId!, {
        branch_id: Number(form.branchId),
        customer_id: form.customerId ? Number(form.customerId) : undefined,
        customer_name: form.customerName || undefined,
        valid_until: form.validUntil || undefined,
        notes: form.notes || undefined,
        payment_terms: form.paymentTerms || undefined,
        items: form.lines,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] })
      closeDialog()
    },
    meta: { successMessage: 'Quotation updated.' },
  })

  const convertMutation = useMutation({
    mutationFn: (id: number) => quotationsApi.convert(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] })
      navigate('/pos')
    },
    meta: { successMessage: 'Quotation converted to a sale.' },
  })

  const duplicateMutation = useMutation({
    mutationFn: (id: number) => quotationsApi.duplicate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quotations'] }),
    meta: { successMessage: 'Quotation duplicated as a new draft.' },
  })

  const pdfMutation = useMutation({
    mutationFn: ({ id }: { id: number; intent: 'print' | 'download' | 'share'; number: string }) => quotationsApi.fetchPdfBlob(id),
    onSuccess: (blob, variables) => {
      const fileName = pdfFileName(variables.number)
      if (variables.intent === 'print') printPdf(blob)
      else if (variables.intent === 'download') downloadPdf(blob, fileName)
      else sharePdf(blob, fileName)
    },
    meta: { successMessage: 'PDF ready.' },
  })

  const isEditing = editingId !== null
  const editingLocked = isEditing && quotationsQuery.data?.data?.find((q: any) => q.id === editingId)?.status === 'converted'

  function updateLine(index: number, patch: Partial<QuotationItemPayload>) {
    setForm((prev) => ({ ...prev, lines: prev.lines.map((l, i) => (i === index ? { ...l, ...patch } : l)) }))
  }

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' }, mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          Quotations
        </Typography>
        <Button variant="contained" startIcon={<Add />} onClick={openCreate}>
          New quotation
        </Button>
      </Stack>

      <Paper variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Number</TableCell>
              <TableCell>Customer</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Valid until</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {quotationsQuery.data?.data?.map((q: any) => (
              <TableRow key={q.id}>
                <TableCell>{q.quotation_number}</TableCell>
                <TableCell>{q.customer?.name ?? q.customer_name ?? '—'}</TableCell>
                <TableCell>
                  <Chip label={q.status} size="small" color={STATUS_COLORS[q.status] ?? 'default'} />
                </TableCell>
                <TableCell>{q.valid_until ? new Date(q.valid_until).toLocaleDateString() : '—'}</TableCell>
                <TableCell align="right">
                  {currency} {Number(q.grand_total).toLocaleString()}
                </TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={(e) => setMenuAnchor({ el: e.currentTarget, quotation: q })}>
                    <MoreVert fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {quotationsQuery.data?.data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                    No quotations yet — create one to send to a customer.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Menu anchorEl={menuAnchor?.el} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
        {menuAnchor && [
          <MenuItem
            key="print"
            onClick={() => {
              pdfMutation.mutate({ id: menuAnchor.quotation.id, intent: 'print', number: menuAnchor.quotation.quotation_number })
              setMenuAnchor(null)
            }}
          >
            <ListItemIcon><Print fontSize="small" /></ListItemIcon>
            <ListItemText>Print</ListItemText>
          </MenuItem>,
          <MenuItem
            key="download"
            onClick={() => {
              pdfMutation.mutate({ id: menuAnchor.quotation.id, intent: 'download', number: menuAnchor.quotation.quotation_number })
              setMenuAnchor(null)
            }}
          >
            <ListItemIcon><Download fontSize="small" /></ListItemIcon>
            <ListItemText>Download PDF</ListItemText>
          </MenuItem>,
          <MenuItem
            key="share"
            onClick={() => {
              pdfMutation.mutate({ id: menuAnchor.quotation.id, intent: 'share', number: menuAnchor.quotation.quotation_number })
              setMenuAnchor(null)
            }}
          >
            <ListItemIcon><Share fontSize="small" /></ListItemIcon>
            <ListItemText>Share / Send</ListItemText>
          </MenuItem>,
          <MenuItem key="edit" disabled={menuAnchor.quotation.status === 'converted'} onClick={() => openEdit(menuAnchor.quotation.id)}>
            <ListItemIcon><Edit fontSize="small" /></ListItemIcon>
            <ListItemText>Edit</ListItemText>
          </MenuItem>,
          <MenuItem
            key="duplicate"
            onClick={() => {
              duplicateMutation.mutate(menuAnchor.quotation.id)
              setMenuAnchor(null)
            }}
          >
            <ListItemIcon><ContentCopy fontSize="small" /></ListItemIcon>
            <ListItemText>Duplicate</ListItemText>
          </MenuItem>,
          !['converted', 'rejected', 'expired'].includes(menuAnchor.quotation.status) && (
            <MenuItem
              key="convert"
              onClick={() => {
                convertMutation.mutate(menuAnchor.quotation.id)
                setMenuAnchor(null)
              }}
            >
              <ListItemIcon><SwapHoriz fontSize="small" /></ListItemIcon>
              <ListItemText>Convert to sale</ListItemText>
            </MenuItem>
          ),
        ]}
      </Menu>

      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{isEditing ? `Edit quotation` : 'New quotation'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              label="Branch"
              value={form.branchId}
              onChange={(e) => setForm({ ...form, branchId: Number(e.target.value) })}
              fullWidth
              disabled={editingLocked}
            >
              {branchesQuery.data?.map((b) => (
                <MenuItem key={b.id} value={b.id}>
                  {b.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Customer (optional)"
              value={form.customerId}
              onChange={(e) => setForm({ ...form, customerId: Number(e.target.value) })}
              fullWidth
              disabled={editingLocked}
            >
              <MenuItem value="">Walk-in</MenuItem>
              {customersQuery.data?.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
            {!form.customerId && (
              <TextField
                label="Customer name"
                value={form.customerName}
                onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                fullWidth
                disabled={editingLocked}
              />
            )}

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Valid until"
                type="date"
                value={form.validUntil}
                onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
                disabled={editingLocked}
                helperText="Shown on the PDF as the validity period"
              />
              <TextField
                label="Payment terms"
                placeholder="e.g. 50% deposit, balance on delivery"
                value={form.paymentTerms}
                onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
                fullWidth
                disabled={editingLocked}
              />
            </Stack>

            {form.lines.map((line, i) => (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} key={i} sx={{ alignItems: { xs: 'stretch', sm: 'center' }, borderBottom: { xs: '1px solid', sm: 0 }, borderColor: 'divider', pb: { xs: 1.5, sm: 0 } }}>
                <TextField
                  select
                  label="Product"
                  size="small"
                  value={line.product_id || ''}
                  onChange={(e) => updateLine(i, { product_id: Number(e.target.value) })}
                  sx={{ flexGrow: 1 }}
                  disabled={editingLocked}
                >
                  {productsQuery.data?.data.map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Qty"
                  type="number"
                  size="small"
                  value={line.quantity}
                  onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })}
                  sx={{ width: { xs: '100%', sm: 90 } }}
                  disabled={editingLocked}
                />
                <TextField
                  label="Unit price"
                  type="number"
                  size="small"
                  value={line.unit_price ?? ''}
                  onChange={(e) => updateLine(i, { unit_price: Number(e.target.value) })}
                  sx={{ width: { xs: '100%', sm: 120 } }}
                  disabled={editingLocked}
                />
                <TextField
                  label="Discount"
                  type="number"
                  size="small"
                  value={line.discount_amount ?? ''}
                  onChange={(e) => updateLine(i, { discount_amount: Number(e.target.value) || undefined })}
                  sx={{ width: { xs: '100%', sm: 110 } }}
                  disabled={editingLocked}
                />
                {!editingLocked && (
                  <IconButton size="small" onClick={() => setForm((prev) => ({ ...prev, lines: prev.lines.filter((_, idx) => idx !== i) }))} sx={{ alignSelf: { xs: 'flex-end', sm: 'center' } }}>
                    <Delete fontSize="small" />
                  </IconButton>
                )}
              </Stack>
            ))}
            {!editingLocked && (
              <Button
                startIcon={<Add />}
                size="small"
                onClick={() => setForm((prev) => ({ ...prev, lines: [...prev.lines, { product_id: 0, quantity: 1 }] }))}
                sx={{ alignSelf: 'flex-start' }}
              >
                Add product
              </Button>
            )}

            <TextField
              label="Notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              fullWidth
              multiline
              rows={2}
              disabled={editingLocked}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeDialog}>Cancel</Button>
          {!editingLocked && (
            <Button
              variant="contained"
              disabled={!form.branchId || form.lines.length === 0 || form.lines.some((l) => !l.product_id)}
              loading={isEditing ? updateMutation.isPending : createMutation.isPending}
              onClick={() => (isEditing ? updateMutation.mutate() : createMutation.mutate())}
            >
              {isEditing ? 'Save changes' : 'Create'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  )
}
