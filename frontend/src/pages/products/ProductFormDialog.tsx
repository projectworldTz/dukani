import { ExpandLess, ExpandMore, PhotoCamera } from '@mui/icons-material'
import {
  Box,
  Button,
  Collapse,
  FormControlLabel,
  Switch,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { categoriesApi, productsApi } from '../../api/endpoints/products'
import { DOSAGE_FORM_LABELS } from '../../api/endpoints/pharmacy'
import { usePlatform } from '../../hooks/usePlatform'
import { gramsToKg, kgToGrams } from '../../utils/quantity'
import { useAuthStore } from '../../stores/authStore'
import type { Product } from '../../types'

interface FormState {
  name: string
  selling_price: string
  cost_price: string
  opening_stock: string
  reorder_level: string
  sku: string
  barcode: string
  category_id: string
  tax_rate: string
  // Pharmacy
  generic_name: string
  strength: string
  dosage_form: string
  pack_size: string
  manufacturer: string
  requires_prescription: boolean
  is_controlled: boolean
  batch_number: string
  expiry_date: string
  // Butchery
  sold_by_weight: boolean
}

const EMPTY: FormState = {
  name: '',
  selling_price: '',
  cost_price: '',
  opening_stock: '',
  reorder_level: '5',
  sku: '',
  barcode: '',
  category_id: '',
  tax_rate: '0',
  generic_name: '',
  strength: '',
  dosage_form: '',
  pack_size: '',
  manufacturer: '',
  requires_prescription: false,
  is_controlled: false,
  batch_number: '',
  expiry_date: '',
  sold_by_weight: false,
}

interface Props {
  open: boolean
  /** When set the dialog edits this product; otherwise it creates a new one. */
  product?: Product | null
  branchId: number | null
  onClose: () => void
}

export function ProductFormDialog({ open, product, branchId, onClose }: Props) {
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))
  const queryClient = useQueryClient()
  const currency = useAuthStore((s) => s.user?.business?.currency ?? '')
  const canAdjustStock = useAuthStore((s) => s.hasPermission('inventory.adjust'))
  const isEdit = !!product
  const { isPharmacy, isButchery } = usePlatform()
  const noun = isPharmacy ? 'medicine' : 'product'

  const [form, setForm] = useState<FormState>(EMPTY)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [showMore, setShowMore] = useState(false)

  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.list, enabled: open })

  useEffect(() => {
    if (!open) return
    setImageFile(null)
    setShowMore(false)
    setForm(
      product
        ? {
            ...EMPTY,
            name: product.name,
            selling_price: String(Number(product.selling_price)),
            cost_price: String(Number(product.cost_price)),
            reorder_level: product.sold_by_weight ? gramsToKg(product.reorder_level ?? 0).replace(/,/g, '') : String(product.reorder_level ?? 0),
            sku: product.sku ?? '',
            category_id: product.category ? String(product.category.id) : '',
            tax_rate: String(Number(product.tax_rate)),
            generic_name: product.generic_name ?? '',
            strength: product.strength ?? '',
            dosage_form: product.dosage_form ?? '',
            pack_size: product.pack_size ?? '',
            manufacturer: product.manufacturer ?? '',
            requires_prescription: !!product.requires_prescription,
            is_controlled: !!product.is_controlled,
            sold_by_weight: !!product.sold_by_weight,
          }
        : // A butchery sells most things by weight, so new products start weighed.
          { ...EMPTY, sold_by_weight: isButchery, reorder_level: isButchery ? '2' : EMPTY.reorder_level },
    )
  }, [open, product, isButchery])

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const mutation = useMutation({
    mutationFn: () => {
      const data = new FormData()
      data.append('name', form.name.trim())
      data.append('selling_price', form.selling_price || '0')
      data.append('cost_price', form.cost_price || '0')
      // Weighed products: stock quantities (and the low-stock level) are stored in grams.
      data.append('reorder_level', String(form.sold_by_weight ? (kgToGrams(form.reorder_level || '0') ?? 0) : form.reorder_level || '0'))
      if (isButchery || form.sold_by_weight) data.append('sold_by_weight', form.sold_by_weight ? '1' : '0')
      data.append('tax_rate', form.tax_rate || '0')
      data.append('sku', form.sku.trim())
      data.append('category_id', form.category_id)
      if (imageFile) data.append('image', imageFile)
      if (isPharmacy) {
        data.append('generic_name', form.generic_name.trim())
        data.append('strength', form.strength.trim())
        data.append('dosage_form', form.dosage_form)
        data.append('pack_size', form.pack_size.trim())
        data.append('manufacturer', form.manufacturer.trim())
        data.append('requires_prescription', form.requires_prescription ? '1' : '0')
        data.append('is_controlled', form.is_controlled ? '1' : '0')
      }

      if (isEdit) return productsApi.update(product.id, data)

      if (form.barcode.trim()) {
        data.append('barcode', form.barcode.trim())
        data.append('barcode_type', 'CODE128')
      } else {
        data.append('generate_barcode', '1')
      }
      if (canAdjustStock && Number(form.opening_stock) > 0) {
        data.append('opening_stock', String(form.sold_by_weight ? (kgToGrams(form.opening_stock) ?? 0) : Math.floor(Number(form.opening_stock))))
        if (branchId) data.append('branch_id', String(branchId))
        if (isPharmacy) {
          data.append('opening_batch_number', form.batch_number.trim())
          data.append('opening_expiry_date', form.expiry_date)
        }
      }
      return productsApi.create(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      onClose()
    },
    meta: { successMessage: isEdit ? `${isPharmacy ? 'Medicine' : 'Product'} updated.` : `${isPharmacy ? 'Medicine' : 'Product'} added — it is ready to sell.` },
  })

  const sell = Number(form.selling_price)
  const cost = Number(form.cost_price)
  const profit = form.selling_price && form.cost_price ? sell - cost : null
  const needsBatch = isPharmacy && !isEdit && Number(form.opening_stock) > 0
  const today = new Date().toISOString().slice(0, 10)
  const canSave =
    form.name.trim().length > 0 && form.selling_price !== '' && sell >= 0 && (!needsBatch || (form.batch_number.trim() !== '' && form.expiry_date >= today))

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth fullScreen={fullScreen}>
      <DialogTitle sx={{ fontWeight: 800 }}>{isEdit ? `Edit ${noun}` : `Add a ${noun}`}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <TextField
            label={isPharmacy ? 'Brand / product name' : 'Product name'}
            placeholder={isPharmacy ? 'e.g. Panadol Extra' : 'e.g. Coca-Cola 500ml'}
            value={form.name}
            onChange={set('name')}
            autoFocus
            fullWidth
            required
          />

          {isButchery && (
            <Stack direction="row" sx={{ px: 1.5, py: 0.5, borderRadius: 2, bgcolor: '#FFF1F2', border: '1px solid', borderColor: '#FECDD3', alignItems: 'center' }}>
              <FormControlLabel
                control={<Switch checked={form.sold_by_weight} onChange={(e) => setForm((f) => ({ ...f, sold_by_weight: e.target.checked }))} disabled={isEdit} />}
                label={
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>Sold by weight (kg)</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {isEdit ? "Can't be changed after the product is created." : 'Meat, fish, vegetables… Turn off for items sold by piece (eggs, trays).'}
                    </Typography>
                  </Box>
                }
              />
            </Stack>
          )}

          {isPharmacy && (
            <>
              <TextField label="Generic name" placeholder="e.g. Paracetamol" value={form.generic_name} onChange={set('generic_name')} helperText="The active ingredient — pharmacists can search by it." fullWidth />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField label="Strength" placeholder="e.g. 500 mg" value={form.strength} onChange={set('strength')} fullWidth />
                <TextField select label="Form" value={form.dosage_form} onChange={set('dosage_form')} fullWidth>
                  <MenuItem value="">Not set</MenuItem>
                  {Object.entries(DOSAGE_FORM_LABELS).map(([value, label]) => (
                    <MenuItem key={value} value={value}>
                      {label}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 0, sm: 2 }} sx={{ px: 1.5, py: 0.5, borderRadius: 2, bgcolor: '#F0FDFA', border: '1px solid', borderColor: '#CCFBF1' }}>
                <FormControlLabel
                  control={<Switch checked={form.requires_prescription} onChange={(e) => setForm((f) => ({ ...f, requires_prescription: e.target.checked }))} />}
                  label={<Typography variant="body2" sx={{ fontWeight: 600 }}>Prescription only (Rx)</Typography>}
                />
                <FormControlLabel
                  control={<Switch color="error" checked={form.is_controlled} onChange={(e) => setForm((f) => ({ ...f, is_controlled: e.target.checked, requires_prescription: e.target.checked || f.requires_prescription }))} />}
                  label={<Typography variant="body2" sx={{ fontWeight: 600 }}>Controlled drug</Typography>}
                />
              </Stack>
            </>
          )}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label={form.sold_by_weight ? 'Selling price per kg' : 'Selling price'}
              type="number"
              required
              value={form.selling_price}
              onChange={set('selling_price')}
              helperText="What the customer pays"
              slotProps={{ input: { startAdornment: <InputAdornment position="start">{currency}</InputAdornment> }, htmlInput: { min: 0 } }}
              fullWidth
            />
            <TextField
              label={form.sold_by_weight ? 'Buying price per kg' : 'Buying price'}
              type="number"
              value={form.cost_price}
              onChange={set('cost_price')}
              helperText="What you paid — used to show profit"
              slotProps={{ input: { startAdornment: <InputAdornment position="start">{currency}</InputAdornment> }, htmlInput: { min: 0 } }}
              fullWidth
            />
          </Stack>

          {profit !== null && (
            <Box sx={{ px: 2, py: 1.25, borderRadius: 2, bgcolor: profit >= 0 ? '#ECFDF5' : '#FEF2F2', border: '1px solid', borderColor: profit >= 0 ? 'success.light' : 'error.light' }}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: profit >= 0 ? 'success.dark' : 'error.dark' }}>
                {profit >= 0
                  ? `You make ${currency} ${profit.toLocaleString()} profit on each ${form.sold_by_weight ? 'kg' : 'one'} sold.`
                  : `Warning: you lose ${currency} ${Math.abs(profit).toLocaleString()} on each ${form.sold_by_weight ? 'kg' : 'one'} sold.`}
              </Typography>
            </Box>
          )}

          {!isEdit && canAdjustStock && (
            <TextField
              label={form.sold_by_weight ? 'How many kg do you have now?' : 'How many do you have now?'}
              type="number"
              value={form.opening_stock}
              onChange={set('opening_stock')}
              slotProps={form.sold_by_weight ? { htmlInput: { min: 0, step: 0.001, inputMode: 'decimal' }, input: { endAdornment: <InputAdornment position="end">kg</InputAdornment> } } : { htmlInput: { min: 0, step: 1 } }}
              helperText={isPharmacy ? 'Count the units of one batch. Add other batches later with “Receive”.' : 'Count what is on your shelf. You can add more stock later.'}
              fullWidth
            />
          )}

          {needsBatch && (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="Batch number" required value={form.batch_number} onChange={set('batch_number')} helperText="Printed on the pack (Lot / Batch)" fullWidth />
              <TextField
                label="Expiry date"
                type="date"
                required
                value={form.expiry_date}
                onChange={set('expiry_date')}
                error={form.expiry_date !== '' && form.expiry_date < today}
                helperText={form.expiry_date !== '' && form.expiry_date < today ? 'This batch has already expired.' : 'Printed on the pack (EXP)'}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: today } }}
                fullWidth
              />
            </Stack>
          )}

          <Button
            onClick={() => setShowMore((v) => !v)}
            endIcon={showMore ? <ExpandLess /> : <ExpandMore />}
            sx={{ alignSelf: 'flex-start', px: 0 }}
          >
            {showMore ? 'Fewer options' : isPharmacy ? 'More options (pack size, maker, category, barcode…)' : 'More options (barcode, category, tax, photo)'}
          </Button>

          <Collapse in={showMore} unmountOnExit>
            <Stack spacing={2.5}>
              {isPharmacy && (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField label="Pack size" placeholder="e.g. 10 × 10 tablets" value={form.pack_size} onChange={set('pack_size')} fullWidth />
                  <TextField label="Manufacturer" placeholder="e.g. GSK" value={form.manufacturer} onChange={set('manufacturer')} fullWidth />
                </Stack>
              )}
              {!isEdit && (
                <TextField
                  label="Barcode"
                  value={form.barcode}
                  onChange={set('barcode')}
                  helperText="Scan the product's barcode here, or leave empty and we'll create one for you."
                  fullWidth
                />
              )}
              <TextField
                label={form.sold_by_weight ? 'Warn me when stock falls to (kg)' : 'Warn me when stock falls to'}
                type="number"
                value={form.reorder_level}
                onChange={set('reorder_level')}
                helperText="You'll see a 'Low stock' badge and a notification at this level."
                slotProps={{ htmlInput: { min: 0, step: 1 } }}
                fullWidth
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField select label="Category" value={form.category_id} onChange={set('category_id')} fullWidth>
                  <MenuItem value="">No category</MenuItem>
                  {categoriesQuery.data?.map((c) => (
                    <MenuItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Tax"
                  type="number"
                  value={form.tax_rate}
                  onChange={set('tax_rate')}
                  slotProps={{ input: { endAdornment: <InputAdornment position="end">%</InputAdornment> }, htmlInput: { min: 0, max: 100 } }}
                  sx={{ minWidth: { sm: 140 } }}
                />
              </Stack>
              <TextField label="Product code / SKU" value={form.sku} onChange={set('sku')} helperText="Optional — your own code for this product." fullWidth />
              <Button component="label" variant="outlined" startIcon={<PhotoCamera />} sx={{ alignSelf: 'flex-start' }}>
                {imageFile ? imageFile.name : 'Add a photo'}
                <input type="file" hidden accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} />
              </Button>
            </Stack>
          </Collapse>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} size="large">
          Cancel
        </Button>
        <Button variant="contained" size="large" disabled={!canSave} loading={mutation.isPending} onClick={() => mutation.mutate()}>
          {isEdit ? 'Save changes' : `Add ${noun}`}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
