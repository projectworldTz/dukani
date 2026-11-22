import { CheckCircleRounded, ErrorRounded, StorefrontRounded } from '@mui/icons-material'
import { Box, Button, CircularProgress, Paper, Typography } from '@mui/material'
import { useMutation } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { authApi } from '../../api/endpoints/auth'

export function VerifyEmailPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const email = params.get('email') ?? ''

  const mutation = useMutation({
    mutationFn: () => authApi.verifyEmail({ token, email }),
    meta: { suppressErrorToast: true },
  })

  useEffect(() => {
    if (token && email) mutation.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, email])

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
        background: 'radial-gradient(circle at 15% 15%, #DBEAFE 0%, #EFF6FF 35%, #EFF6FF 100%)',
      }}
    >
      <Paper
        elevation={0}
        sx={{ p: 5, width: '100%', maxWidth: 420, borderRadius: 4, boxShadow: '0 30px 60px -20px rgba(30, 58, 138, 0.35)', textAlign: 'center' }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.25, mb: 3 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, #60A5FA 0%, #2563EB 100%)',
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.45)',
            }}
          >
            <StorefrontRounded sx={{ color: '#0B1A3A', fontSize: 20 }} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            Dukani
          </Typography>
        </Box>

        {!token || !email ? (
          <>
            <ErrorRounded sx={{ fontSize: 48, color: '#DC2626', mb: 1 }} />
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              Invalid verification link
            </Typography>
          </>
        ) : mutation.isPending || mutation.isIdle ? (
          <>
            <CircularProgress size={40} sx={{ color: '#3B82F6', mb: 2 }} />
            <Typography variant="body2" color="text.secondary">
              Verifying your email…
            </Typography>
          </>
        ) : mutation.isSuccess ? (
          <>
            <CheckCircleRounded sx={{ fontSize: 48, color: '#2563EB', mb: 1 }} />
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              Email verified
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Your email address has been confirmed.
            </Typography>
          </>
        ) : (
          <>
            <ErrorRounded sx={{ fontSize: 48, color: '#DC2626', mb: 1 }} />
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              Verification failed
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {(mutation.error as any)?.response?.data?.message ?? 'This link is invalid or has already been used.'}
            </Typography>
          </>
        )}

        <Button component={Link} to="/" fullWidth sx={{ mt: 3 }} variant="outlined">
          Go to Dukani
        </Button>
      </Paper>
    </Box>
  )
}
