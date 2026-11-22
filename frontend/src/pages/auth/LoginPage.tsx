import { zodResolver } from '@hookform/resolvers/zod'
import { Inventory2Rounded, PointOfSaleRounded, StorefrontRounded, TrendingUpRounded } from '@mui/icons-material'
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { authApi } from '../../api/endpoints/auth'
import { useAuthStore } from '../../stores/authStore'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
})

type FormValues = z.infer<typeof schema>

const HIGHLIGHTS = [
  { icon: <PointOfSaleRounded fontSize="small" />, text: 'Fast POS checkout with offline-ready sales' },
  { icon: <Inventory2Rounded fontSize="small" />, text: 'Real-time inventory across every branch' },
  { icon: <TrendingUpRounded fontSize="small" />, text: 'Reports that tell you what to restock next' },
]

export function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const mutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      setAuth(data.token, data.user)
      navigate('/')
    },
    meta: { suppressErrorToast: true },
  })

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: { xs: 1, sm: 2 },
        background: 'radial-gradient(circle at 15% 15%, #DBEAFE 0%, #EFF6FF 35%, #EFF6FF 100%)',
      }}
    >
      <Paper
        elevation={0}
        sx={{
          display: 'flex',
          width: '100%',
          maxWidth: 920,
          minHeight: { xs: 'auto', md: 560 },
          borderRadius: 4,
          overflow: 'hidden',
          boxShadow: '0 30px 60px -20px rgba(30, 58, 138, 0.35)',
        }}
      >
        {/* Branding panel */}
        <Box
          sx={{
            flex: '1 1 45%',
            display: { xs: 'none', md: 'flex' },
            flexDirection: 'column',
            justifyContent: 'space-between',
            p: 5,
            position: 'relative',
            overflow: 'hidden',
            color: '#EFF6FF',
            background: 'linear-gradient(160deg, #0F2350 0%, #1E40AF 45%, #2563EB 100%)',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              width: 320,
              height: 320,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(96, 165, 250,0.35) 0%, rgba(96, 165, 250,0) 70%)',
              top: -120,
              right: -100,
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              width: 260,
              height: 260,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(251, 191, 36,0.18) 0%, rgba(251, 191, 36,0) 70%)',
              bottom: -80,
              left: -60,
            }}
          />

          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 5 }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'linear-gradient(135deg, #60A5FA 0%, #BFDBFE 100%)',
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.45)',
                }}
              >
                <StorefrontRounded sx={{ color: '#0B1A3A', fontSize: 22 }} />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: 0.3 }}>
                Dukani
              </Typography>
            </Box>

            <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.25, mb: 1.5 }}>
              Run your whole shop from one dashboard.
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(219, 234, 254, 0.8)' }}>
              Sales, stock, staff and reports — everything a growing business needs, in one place.
            </Typography>
          </Box>

          <Stack spacing={2} sx={{ position: 'relative', zIndex: 1 }}>
            {HIGHLIGHTS.map((h) => (
              <Stack key={h.text} direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '9px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'rgba(255,255,255,0.12)',
                    color: '#BFDBFE',
                    flexShrink: 0,
                  }}
                >
                  {h.icon}
                </Box>
                <Typography variant="body2" sx={{ color: 'rgba(239, 246, 255, 0.92)' }}>
                  {h.text}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>

        {/* Form panel */}
        <Box
          sx={{
            flex: '1 1 55%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            p: { xs: 2.5, sm: 6 },
            bgcolor: '#FFFFFF',
          }}
        >
          <Box sx={{ maxWidth: 360, width: '100%', mx: 'auto' }}>
            <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.5 }}>
              Welcome back
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Sign in to your business account.
            </Typography>

            {mutation.isError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {(mutation.error as any)?.response
                  ? ((mutation.error as any).response.data?.message ?? 'Invalid email or password.')
                  : 'Could not reach the server. Check that the backend is running and try again.'}
              </Alert>
            )}

            <form onSubmit={handleSubmit((data) => mutation.mutate(data))}>
              <Stack spacing={2}>
                <TextField
                  label="Email"
                  type="email"
                  fullWidth
                  autoFocus
                  {...register('email')}
                  error={!!errors.email}
                  helperText={errors.email?.message}
                />
                <TextField
                  label="Password"
                  type="password"
                  fullWidth
                  {...register('password')}
                  error={!!errors.password}
                  helperText={errors.password?.message}
                />
                <Box sx={{ textAlign: 'right', mt: -1 }}>
                  <Link to="/forgot-password" style={{ color: '#2563EB', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                    Forgot password?
                  </Link>
                </Box>
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  loading={mutation.isPending}
                  sx={{
                    py: 1.25,
                    fontWeight: 700,
                    textTransform: 'none',
                    fontSize: 15,
                    background: 'linear-gradient(135deg, #2563EB 0%, #3B82F6 100%)',
                    boxShadow: '0 8px 20px -6px rgba(29, 78, 216, 0.55)',
                    '&:hover': { background: 'linear-gradient(135deg, #1D4ED8 0%, #2563EB 100%)' },
                  }}
                >
                  Sign in
                </Button>
              </Stack>
            </form>

            <Typography variant="body2" sx={{ mt: 3, textAlign: 'center' }} color="text.secondary">
              New business?{' '}
              <Link to="/register" style={{ color: '#2563EB', fontWeight: 600, textDecoration: 'none' }}>
                Register
              </Link>
            </Typography>
          </Box>
        </Box>
      </Paper>
    </Box>
  )
}
