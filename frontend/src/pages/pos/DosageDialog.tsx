import { MedicationRounded } from '@mui/icons-material'
import { Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material'
import { useEffect, useState } from 'react'
import { DOSAGE_PRESETS } from '../../api/endpoints/pharmacy'

interface Props {
  open: boolean
  medicine: string
  initial: string
  onClose: () => void
  onSave: (dosage: string) => void
}

/** How the patient should take a medicine — tap a common instruction or type your own. Printed on the receipt. */
export function DosageDialog({ open, medicine, initial, onClose, onSave }: Props) {
  const [text, setText] = useState('')
  useEffect(() => {
    if (open) setText(initial)
  }, [open, initial])

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
        <MedicationRounded color="primary" /> How to take it
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {medicine}
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2 }}>
          {DOSAGE_PRESETS.map((p) => (
            <Chip key={p} label={p} onClick={() => setText(p)} color={text === p ? 'primary' : 'default'} variant={text === p ? 'filled' : 'outlined'} sx={{ fontWeight: 500 }} />
          ))}
        </Box>
        <TextField
          label="Dosage instructions"
          placeholder="e.g. 1 tablet 3 times daily for 5 days"
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 255))}
          multiline
          minRows={2}
          fullWidth
          autoFocus
          helperText="Printed on the receipt for the patient."
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {initial && (
          <Button color="error" onClick={() => onSave('')} sx={{ mr: 'auto' }}>
            Remove
          </Button>
        )}
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => onSave(text.trim())} disabled={!text.trim()}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  )
}
