import { Business, Close, EmailRounded, EventAvailable, PersonRounded, PhoneRounded, StorefrontRounded } from '@mui/icons-material'
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { platformApi } from '../../api/endpoints/platform'

function Field({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
      <Box sx={{ color: 'text.secondary', mt: 0.25 }}>{icon}</Box>
      <Box>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {value}
        </Typography>
      </Box>
    </Stack>
  )
}

export function BusinessDetailDialog({ businessId, onClose }: { businessId: number | null; onClose: () => void }) {
  const query = useQuery({
    queryKey: ['platform', 'business', businessId],
    queryFn: () => platformApi.business(businessId as number),
    enabled: businessId !== null,
  })

  return (
    <Dialog open={businessId !== null} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {query.data?.name ?? 'Business details'}
        <IconButton onClick={onClose} size="small">
          <Close fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {query.isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        )}

        {query.data && (
          <Stack spacing={3}>
            <Stack direction="row" spacing={1}>
              {query.data.deleted_at ? (
                <Chip label="Deleted" size="small" color="error" variant="outlined" />
              ) : (
                <Chip
                  label={query.data.status}
                  size="small"
                  color={query.data.status === 'active' ? 'success' : 'warning'}
                  variant="outlined"
                />
              )}
              {query.data.category && <Chip label={query.data.category} size="small" variant="outlined" />}
              {query.data.plan && <Chip label={query.data.plan} size="small" variant="outlined" />}
            </Stack>

            {query.data.deleted_at && (
              <Alert severity="error" variant="outlined">
                Deleted on {new Date(query.data.deleted_at).toLocaleString()}
                {query.data.deletion_reason && (
                  <>
                    <br />
                    <strong>Reason:</strong> {query.data.deletion_reason}
                  </>
                )}
              </Alert>
            )}

            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                Owner
              </Typography>
              <Stack spacing={1.5}>
                <Field icon={<PersonRounded fontSize="small" />} label="Name" value={query.data.owner?.name ?? '—'} />
                <Field icon={<EmailRounded fontSize="small" />} label="Email" value={query.data.owner?.email ?? '—'} />
                <Field icon={<PhoneRounded fontSize="small" />} label="Phone" value={query.data.owner?.phone ?? '—'} />
                <Field
                  icon={<EventAvailable fontSize="small" />}
                  label="Owner since"
                  value={query.data.owner?.joined_at ? new Date(query.data.owner.joined_at).toLocaleDateString() : '—'}
                />
              </Stack>
            </Box>

            <Divider />

            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                Business
              </Typography>
              <Stack spacing={1.5}>
                <Field icon={<StorefrontRounded fontSize="small" />} label="Business type" value={query.data.category ?? 'Not specified'} />
                <Field icon={<Business fontSize="small" />} label="Currency / Timezone" value={`${query.data.currency} · ${query.data.timezone}`} />
                <Field
                  icon={<EventAvailable fontSize="small" />}
                  label="License expires"
                  value={query.data.license_expires_at ? new Date(query.data.license_expires_at).toLocaleDateString() : 'Not set'}
                />
                <Field icon={<EventAvailable fontSize="small" />} label="Registered on" value={new Date(query.data.created_at).toLocaleDateString()} />
                <Field icon={<PersonRounded fontSize="small" />} label="Staff count" value={query.data.staff_count} />
              </Stack>
            </Box>

            {query.data.branches.length > 0 && (
              <>
                <Divider />
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                    Branches
                  </Typography>
                  <Stack spacing={1}>
                    {query.data.branches.map((b) => (
                      <Stack key={b.id} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <Typography variant="body2">{b.name}</Typography>
                        <Chip label={b.code} size="small" variant="outlined" />
                        {b.is_main && <Chip label="Main" size="small" color="success" variant="outlined" />}
                      </Stack>
                    ))}
                  </Stack>
                </Box>
              </>
            )}
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  )
}
