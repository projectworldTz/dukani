import { Box, Button, FormControlLabel, Paper, Stack, Switch, TextField, Typography } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { businessApi } from '../../api/endpoints/business'
import { useAuthStore } from '../../stores/authStore'

export function SettingsPage() {
  const queryClient = useQueryClient()
  const { user, setUser } = useAuthStore()
  const query = useQuery({ queryKey: ['business-settings'], queryFn: businessApi.settings })
  const [form, setForm] = useState<Record<string, string>>({})
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(false)

  useEffect(() => {
    if (query.data) {
      setForm({
        name: query.data.business.name ?? '',
        currency: query.data.business.currency ?? '',
        address: query.data.settings?.address ?? '',
        phone: query.data.settings?.phone ?? '',
        email: query.data.settings?.email ?? '',
        tin: query.data.settings?.tin ?? '',
        default_tax_rate: String(query.data.settings?.default_tax_rate ?? '0'),
        receipt_footer_text: query.data.settings?.receipt_footer_text ?? '',
        loyalty_spend_per_point: String(query.data.settings?.loyalty_spend_per_point ?? '10000'),
        loyalty_point_value: String(query.data.settings?.loyalty_point_value ?? '0'),
      })
      setLoyaltyEnabled(!!query.data.settings?.loyalty_enabled)
    }
  }, [query.data])

  const mutation = useMutation({
    mutationFn: () =>
      businessApi.updateSettings({
        ...form,
        default_tax_rate: Number(form.default_tax_rate),
        loyalty_enabled: loyaltyEnabled,
        loyalty_spend_per_point: Number(form.loyalty_spend_per_point),
        loyalty_point_value: Number(form.loyalty_point_value),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['business-settings'] })
      if (user && data?.business) {
        setUser({ ...user, business: { ...(user.business ?? {}), ...data.business } })
      }
    },
    meta: { successMessage: 'Settings saved.' },
  })

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 800 }} gutterBottom>
        Business Settings
      </Typography>

      <Paper variant="outlined" sx={{ p: 3, maxWidth: 480 }}>
        <Stack spacing={2}>
          <TextField label="Business Name" value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <TextField label="Currency" value={form.currency ?? ''} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
          <TextField label="Address" value={form.address ?? ''} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <TextField label="Phone" value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <TextField label="Email" value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <TextField label="TIN" value={form.tin ?? ''} onChange={(e) => setForm({ ...form, tin: e.target.value })} />
          <TextField
            label="Default tax rate (%)"
            type="number"
            value={form.default_tax_rate ?? ''}
            onChange={(e) => setForm({ ...form, default_tax_rate: e.target.value })}
          />
          <TextField
            label="Receipt footer text"
            multiline
            rows={2}
            value={form.receipt_footer_text ?? ''}
            onChange={(e) => setForm({ ...form, receipt_footer_text: e.target.value })}
          />

          <FormControlLabel
            control={<Switch checked={loyaltyEnabled} onChange={(e) => setLoyaltyEnabled(e.target.checked)} />}
            label="Enable loyalty points"
          />
          {loyaltyEnabled && (
            <>
              <TextField
                label={`Spend per point (${form.currency})`}
                type="number"
                value={form.loyalty_spend_per_point ?? ''}
                onChange={(e) => setForm({ ...form, loyalty_spend_per_point: e.target.value })}
                helperText="E.g. 10000 = customers earn 1 point per 10,000 spent"
              />
              <TextField
                label={`Value per point (${form.currency})`}
                type="number"
                value={form.loyalty_point_value ?? ''}
                onChange={(e) => setForm({ ...form, loyalty_point_value: e.target.value })}
                helperText="How much one redeemed point is worth off at checkout"
              />
            </>
          )}

          <Button variant="contained" loading={mutation.isPending} onClick={() => mutation.mutate()} sx={{ alignSelf: 'flex-start' }}>
            Save
          </Button>
        </Stack>
      </Paper>
    </Box>
  )
}
