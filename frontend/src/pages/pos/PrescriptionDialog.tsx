import { AssignmentOutlined } from '@mui/icons-material'
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography, useMediaQuery, useTheme } from '@mui/material'
import { useEffect, useState } from 'react'
import type { Prescription } from '../../types'

interface Props {
  open: boolean
  /** Names of the prescription-only medicines in the cart. */
  rxMedicines: string[]
  initial: Prescription | null
  /** Suggested patient details (e.g. from the selected customer). */
  suggestion?: { patient_name?: string; patient_phone?: string | null }
  onClose: () => void
  onSave: (prescription: Prescription) => void
}

const EMPTY: Prescription = { rx_number: '', prescriber_name: '', patient_name: '', patient_age: null, patient_phone: '', prescriber_reg_no: '', facility: '', issued_on: '', notes: '' }

/** Capture the prescription before prescription-only medicines are dispensed. */
export function PrescriptionDialog({ open, rxMedicines, initial, suggestion, onClose, onSave }: Props) {
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))
  const [form, setForm] = useState<Prescription>(EMPTY)

  useEffect(() => {
    if (open) setForm(initial ?? { ...EMPTY, patient_name: suggestion?.patient_name ?? '', patient_phone: suggestion?.patient_phone ?? '' })
  }, [open, initial, suggestion])

  const set = (key: keyof Prescription) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const today = new Date().toISOString().slice(0, 10)
  const valid = form.rx_number.trim() !== '' && form.prescriber_name.trim() !== '' && form.patient_name.trim() !== '' && (!form.issued_on || form.issued_on <= today)

  function save() {
    if (!valid) return
    onSave({
      ...form,
      rx_number: form.rx_number.trim(),
      prescriber_name: form.prescriber_name.trim(),
      patient_name: form.patient_name.trim(),
      patient_age: form.patient_age ? Number(form.patient_age) : null,
      patient_phone: form.patient_phone?.trim() || null,
      prescriber_reg_no: form.prescriber_reg_no?.trim() || null,
      facility: form.facility?.trim() || null,
      issued_on: form.issued_on || null,
      notes: form.notes?.trim() || null,
    })
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth fullScreen={fullScreen}>
      <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
        <AssignmentOutlined color="primary" /> Prescription
      </DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          Required for: <strong>{rxMedicines.join(', ')}</strong>. Check the original prescription before dispensing.
        </Alert>
        <Stack spacing={2}>
          <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1 }}>
            Patient
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="Patient name" required value={form.patient_name} onChange={set('patient_name')} autoFocus fullWidth />
            <TextField label="Age" type="number" value={form.patient_age ?? ''} onChange={(e) => setForm((f) => ({ ...f, patient_age: e.target.value === '' ? null : Number(e.target.value) }))} slotProps={{ htmlInput: { min: 0, max: 130 } }} sx={{ width: { sm: 120 } }} />
          </Stack>
          <TextField label="Patient phone" value={form.patient_phone ?? ''} onChange={set('patient_phone')} fullWidth />

          <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1, pt: 1 }}>
            Prescription
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="Rx / prescription number" required value={form.rx_number} onChange={set('rx_number')} fullWidth />
            <TextField
              label="Date written"
              type="date"
              value={form.issued_on ?? ''}
              onChange={set('issued_on')}
              error={!!form.issued_on && form.issued_on > today}
              helperText={form.issued_on && form.issued_on > today ? "Can't be in the future" : undefined}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: today } }}
              sx={{ minWidth: { sm: 180 } }}
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="Prescriber (doctor) name" required value={form.prescriber_name} onChange={set('prescriber_name')} fullWidth />
            <TextField label="Registration no." value={form.prescriber_reg_no ?? ''} onChange={set('prescriber_reg_no')} sx={{ minWidth: { sm: 180 } }} />
          </Stack>
          <TextField label="Hospital / clinic" value={form.facility ?? ''} onChange={set('facility')} fullWidth />
          <TextField label="Notes (optional)" value={form.notes ?? ''} onChange={set('notes')} multiline minRows={2} fullWidth />
        </Stack>
        <Box sx={{ mt: 1.5 }}>
          <Typography variant="caption" color="text.secondary">
            Saved with the sale and printed on the receipt. Fields marked * are required.
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} size="large">
          Cancel
        </Button>
        <Button variant="contained" size="large" disabled={!valid} onClick={save}>
          Save prescription
        </Button>
      </DialogActions>
    </Dialog>
  )
}
