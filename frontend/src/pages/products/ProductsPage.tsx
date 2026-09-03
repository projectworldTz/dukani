import { Add, Download, QrCode2, Upload } from '@mui/icons-material'
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
  InputAdornment,
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
import { categoriesApi, productsApi } from '../../api/endpoints/products'

interface ProductForm {
  name: string
  sku: string
  cost_price: string
  selling_price: string
  tax_rate: string
  category_id: string
  generate_barcode: boolean
}

const EMPTY_FORM: ProductForm = {
  name: '',
  sku: '',
  cost_price: '',
  selling_price: '',
  tax_rate: '0',
  category_id: '',
  generate_barcode: true,
}

export function ProductsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [selected, setSelected] = useState<number[]>([])
  const [labelsOpen, setLabelsOpen] = useState(false)
  const [labelCopies, setLabelCopies] = useState(1)
  const [labelSize, setLabelSize] = useState('medium')
  const [labelIncludeQr, setLabelIncludeQr] = useState(false)
  const [importResult, setImportResult] = useState<{ created: number; errors: string[] } | null>(null)

  const productsQuery = useQuery({ queryKey: ['products', search], queryFn: () => productsApi.list({ search: search || undefined }) })
  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.list })

  const createMutation = useMutation({
    mutationFn: () => {
      const data = new FormData()
      data.append('name', form.name)
      if (form.sku) data.append('sku', form.sku)
      data.append('cost_price', form.cost_price || '0')
      data.append('selling_price', form.selling_price || '0')
      data.append('tax_rate', form.tax_rate || '0')
      if (form.category_id) data.append('category_id', form.category_id)
      if (form.generate_barcode) data.append('generate_barcode', '1')
      if (imageFile) data.append('image', imageFile)
      return productsApi.create(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      setDialogOpen(false)
      setForm(EMPTY_FORM)
      setImageFile(null)
    },
    meta: { successMessage: 'Product created.' },
  })

  const exportMutation = useMutation({
    mutationFn: () => productsApi.exportCsvBlobUrl(),
    onSuccess: (url) => {
      const a = document.createElement('a')
      a.href = url
      a.download = 'products.csv'
      a.click()
    },
    meta: { successMessage: 'Export ready.' },
  })

  const importMutation = useMutation({
    mutationFn: (file: File) => productsApi.importCsv(file),
    onSuccess: (result) => {
      setImportResult(result)
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })

  const labelsMutation = useMutation({
    mutationFn: () => productsApi.labelsPdfBlobUrl(selected, labelCopies, labelSize, labelIncludeQr),
    onSuccess: (url) => {
      window.open(url, '_blank')
      setLabelsOpen(false)
    },
    meta: { successMessage: 'Labels ready.' },
  })

  function toggleSelected(id: number) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' }, mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          Products
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          {selected.length > 0 && (
            <Button variant="outlined" startIcon={<QrCode2 />} onClick={() => setLabelsOpen(true)}>
              Print labels ({selected.length})
            </Button>
          )}
          <Button variant="outlined" startIcon={<Download />} loading={exportMutation.isPending} onClick={() => exportMutation.mutate()}>
            Export CSV
          </Button>
          <Button component="label" variant="outlined" startIcon={<Upload />} loading={importMutation.isPending}>
            Import CSV
            <input
              type="file"
              hidden
              accept=".csv"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) importMutation.mutate(file)
                e.target.value = ''
              }}
            />
          </Button>
          <Button variant="contained" startIcon={<Add />} onClick={() => setDialogOpen(true)}>
            Add product
          </Button>
        </Stack>
      </Stack>

      {importResult && (
        <Alert severity={importResult.errors.length ? 'warning' : 'success'} onClose={() => setImportResult(null)} sx={{ mb: 2 }}>
          Imported {importResult.created} product(s).
          {importResult.errors.length > 0 && ` ${importResult.errors.length} row(s) skipped: ${importResult.errors.join('; ')}`}
        </Alert>
      )}

      <TextField
        placeholder="Search by name, SKU, or barcode…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        fullWidth
        sx={{ mb: 2 }}
      />

      <Paper variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox" />
              <TableCell>Name</TableCell>
              <TableCell>SKU</TableCell>
              <TableCell>Barcode</TableCell>
              <TableCell align="right">Cost</TableCell>
              <TableCell align="right">Price</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {productsQuery.data?.data.map((product) => (
              <TableRow key={product.id}>
                <TableCell padding="checkbox">
                  <Checkbox checked={selected.includes(product.id)} onChange={() => toggleSelected(product.id)} />
                </TableCell>
                <TableCell>{product.name}</TableCell>
                <TableCell>{product.sku ?? '—'}</TableCell>
                <TableCell>
                  {product.barcodes[0] ? (
                    <Chip icon={<QrCode2 fontSize="small" />} label={product.barcodes[0].code} size="small" />
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell align="right">{Number(product.cost_price).toLocaleString()}</TableCell>
                <TableCell align="right">{Number(product.selling_price).toLocaleString()}</TableCell>
                <TableCell>
                  <Chip label={product.status} size="small" color={product.status === 'active' ? 'success' : 'default'} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add product</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Product name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} fullWidth />
            <TextField label="SKU (optional)" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} fullWidth />
            <TextField
              select
              label="Category"
              value={form.category_id}
              onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              fullWidth
            >
              <MenuItem value="">None</MenuItem>
              {categoriesQuery.data?.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Cost price"
                type="number"
                value={form.cost_price}
                onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
                fullWidth
              />
              <TextField
                label="Selling price"
                type="number"
                value={form.selling_price}
                onChange={(e) => setForm({ ...form, selling_price: e.target.value })}
                fullWidth
              />
            </Stack>
            <TextField
              label="Tax rate"
              type="number"
              value={form.tax_rate}
              onChange={(e) => setForm({ ...form, tax_rate: e.target.value })}
              slotProps={{ input: { endAdornment: <InputAdornment position="end">%</InputAdornment> } }}
              sx={{ width: 160 }}
            />
            <Button component="label" variant="outlined">
              {imageFile ? imageFile.name : 'Upload photo (optional)'}
              <input type="file" hidden accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} />
            </Button>
            <Typography variant="caption" color="text.secondary">
              An internal Code128 barcode (PRD000001…) will be generated automatically. You can assign a
              manufacturer barcode afterward from the product's detail view.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!form.name || !form.cost_price || !form.selling_price}
            loading={createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={labelsOpen} onClose={() => setLabelsOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Print labels ({selected.length} product{selected.length === 1 ? '' : 's'})</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Copies per product" type="number" value={labelCopies} onChange={(e) => setLabelCopies(Number(e.target.value))} />
            <TextField select label="Label size" value={labelSize} onChange={(e) => setLabelSize(e.target.value)}>
              <MenuItem value="small">Small (38x20mm)</MenuItem>
              <MenuItem value="medium">Medium (50x30mm)</MenuItem>
              <MenuItem value="large">Large (70x40mm)</MenuItem>
            </TextField>
            <Stack direction="row" sx={{ alignItems: 'center' }}>
              <Checkbox checked={labelIncludeQr} onChange={(e) => setLabelIncludeQr(e.target.checked)} />
              <Typography variant="body2">Include QR code</Typography>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setLabelsOpen(false)}>Cancel</Button>
          <Button variant="contained" loading={labelsMutation.isPending} onClick={() => labelsMutation.mutate()}>
            Generate PDF
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
