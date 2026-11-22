import { WhatsApp } from '@mui/icons-material'
import { Alert, Box, Button } from '@mui/material'
import { useAuthStore } from '../../stores/authStore'
import { contactLinks } from './contactLinks'

/**
 * Slim banner during the free trial: how many days are left and a one-tap way to
 * subscribe. Turns orange in the last 3 days.
 */
export function TrialBanner() {
  const business = useAuthStore((s) => s.user?.business)
  const sub = business?.subscription
  if (!sub?.is_trial || sub.is_expired || sub.days_left === null) return null

  const days = sub.days_left
  const urgent = days <= 3
  const links = contactLinks(sub.contact, business?.name)
  const href = links.whatsapp ?? links.call
  const when = days === 0 ? 'ends today' : days === 1 ? 'ends tomorrow' : `${days} days left`

  return (
    <Alert
      severity={urgent ? 'warning' : 'info'}
      icon={false}
      sx={{ borderRadius: 0, py: 0.25, alignItems: 'center', '& .MuiAlert-message': { width: '100%', py: 0.75 } }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <Box sx={{ fontSize: 14 }}>
          <strong>Free trial · {when}.</strong>{' '}
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
            Subscribe to keep using Dukani without interruption{sub.contact.phone ? ` — call ${sub.contact.phone}` : ''}.
          </Box>
        </Box>
        {href && (
          <Button
            size="small"
            variant={urgent ? 'contained' : 'outlined'}
            color={urgent ? 'warning' : 'primary'}
            startIcon={links.whatsapp ? <WhatsApp /> : undefined}
            href={href}
            target={links.whatsapp ? '_blank' : undefined}
            rel="noopener"
            sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}
          >
            Subscribe
          </Button>
        )}
      </Box>
    </Alert>
  )
}
