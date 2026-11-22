import { zodResolver } from '@hookform/resolvers/zod'
import { StorefrontRounded } from '@mui/icons-material'
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { authApi } from '../../api/endpoints/auth'

const schema = z
  .object({
    password: z.string().min(8, 'At least 8 characters'),
    password_confirmation: z.string(),
  })
  .refine((data) => data.password === data.password_confirmation, {
    message: 'Passwords do not match',
    path: ['password_confirmation'],
  })

type FormValues = z.infer<typeof schema>

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const email = params.get('email') ?? ''

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const mutation = useMutation({
    mutationFn: (data: FormValues) => authApi.resetPassword({ ...data, token, email }),
    meta: { suppressErrorToast: true },
  })

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
        sx={{ p: 5, width: '100%', maxWidth: 420, borderRadius: 4, boxShadow: '0 30px 60px -20px rgba(30, 58, 138, 0.35)' }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 3 }}>
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

        <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.5 }}>
          Set a new password
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          For {email || 'your account'}.
        </Typography>

        {!token || !email ? (
          <Alert severity="error">This reset link is missing information. Request a new one.</Alert>
        ) : mutation.isSuccess ? (
          <Alert severity="success" sx={{ mb: 2 }}>
            {mutation.data.message}
          </Alert>
        ) : (
          <>
            {mutation.isError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {(mutation.error as any)?.response?.data?.message ?? 'This link is invalid or has expired.'}
              </Alert>
            )}
            <form onSubmit={handleSubmit((data) => mutation.mutate(data))}>
              <Stack spacing={2}>
                <TextField
                  label="New password"
                  type="password"
                  fullWidth
                  autoFocus
                  {...register('password')}
                  error={!!errors.password}
                  helperText={errors.password?.message}
                />
                <TextField
                  label="Confirm new password"
                  type="password"
                  fullWidth
                  {...register('password_confirmation')}
                  error={!!errors.password_confirmation}
                  helperText={errors.password_confirmation?.message}
                />
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
                    '&:hover': { background: 'linear-gradient(135deg, #1D4ED8 0%, #2563EB 100%)' },
                  }}
                >
                  Reset password
                </Button>
              </Stack>
            </form>
          </>
        )}

        {mutation.isSuccess && (
          <Button fullWidth sx={{ mt: 2 }} onClick={() => navigate('/login')}>
            Go to sign in
          </Button>
        )}

        <Typography variant="body2" sx={{ mt: 3, textAlign: 'center' }} color="text.secondary">
          <Link to="/login" style={{ color: '#2563EB', fontWeight: 600, textDecoration: 'none' }}>
            Back to sign in
          </Link>
        </Typography>
      </Paper>
    </Box>
  )
}
