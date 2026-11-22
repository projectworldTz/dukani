import { EmailOutlined, LockClockOutlined, LogoutRounded, PhoneRounded, WhatsApp } from '@mui/icons-material'
import { Box, Button, Paper, Stack, Typography } from '@mui/material'
import { authApi } from '../../api/endpoints/auth'
import { useAuthStore } from '../../stores/authStore'
import { useSubscriptionStore } from '../../stores/subscriptionStore'
import { contactLinks } from './contactLinks'

/**
 * Shown instead of the app once the free trial (or a paid license) has ended. Every
 * API call is refused with 402 until the seller extends the license, so the only
 * useful things here are: how to pay, and signing out.
 */
export function SubscriptionEndedScreen() {
  const ended = useSubscriptionStore((s) => s.ended)
  const setEnded = useSubscriptionStore((s) => s.setEnded)
  const user = useAuthStore((s) => s.user)
  const adminSession = useAuthStore((s) => s.adminSession)
  const contact = ended?.subscription?.contact ?? user?.business?.subscription?.contact
  const isTrial = ended?.subscription?.is_trial ?? user?.business?.subscription?.is_trial
  const links = contactLinks(contact, user?.business?.name)

  async function signOut() {
    try {
      await authApi.logout()
    } catch {
      // Already locked out — clearing the session locally is what matters.
    }
    setEnded(null)
    useAuthStore.getState().clear()
  }

  function backToAdmin() {
    setEnded(null)
    useAuthStore.getState().exitImpersonation()
  }

  return (
    <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', p: 2, bgcolor: 'background.default' }}>
      <Paper sx={{ maxWidth: 480, width: '100%', p: { xs: 3, sm: 4 }, borderRadius: 4, textAlign: 'center' }}>
        <Box sx={{ width: 64, height: 64, borderRadius: '50%', bgcolor: 'warning.light', color: 'warning.dark', display: 'grid', placeItems: 'center', mx: 'auto', mb: 2 }}>
          <LockClockOutlined sx={{ fontSize: 34 }} />
        </Box>
        <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
          {isTrial ? 'Your free trial has ended' : 'Your subscription has ended'}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {user?.business?.name ? <strong>{user.business.name}</strong> : 'Your business'} is paused. Your data is safe — subscribe and you
          can carry on exactly where you left off.
        </Typography>

        {contact?.payment_info && (
          <Paper variant="outlined" sx={{ p: 2, mb: 2.5, borderRadius: 3, bgcolor: 'action.hover', textAlign: 'left' }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase' }}>
              How to pay
            </Typography>
            <Typography sx={{ fontWeight: 600, whiteSpace: 'pre-line' }}>{contact.payment_info}</Typography>
          </Paper>
        )}

        <Stack spacing={1.25}>
          {links.whatsapp && (
            <Button size="large" variant="contained" color="success" startIcon={<WhatsApp />} href={links.whatsapp} target="_blank" rel="noopener" sx={{ fontWeight: 700 }}>
              Subscribe on WhatsApp
            </Button>
          )}
          {links.call && (
            <Button size="large" variant={links.whatsapp ? 'outlined' : 'contained'} startIcon={<PhoneRounded />} href={links.call} sx={{ fontWeight: 700 }}>
              Call {contact?.phone}
            </Button>
          )}
          {links.email && (
            <Button size="large" variant="outlined" startIcon={<EmailOutlined />} href={links.email} sx={{ fontWeight: 700 }}>
              Email {contact?.email}
            </Button>
          )}
          {!links.whatsapp && !links.call && !links.email && ended?.message && <Typography color="text.secondary">{ended.message}</Typography>}
        </Stack>

        <Box sx={{ mt: 3 }}>
          {adminSession ? (
            <Button onClick={backToAdmin}>Back to Platform Admin</Button>
          ) : (
            <Button color="inherit" startIcon={<LogoutRounded />} onClick={signOut}>
              Sign out
            </Button>
          )}
        </Box>
      </Paper>
    </Box>
  )
}
