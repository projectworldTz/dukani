import { zodResolver } from '@hookform/resolvers/zod'
import { StorefrontRounded } from '@mui/icons-material'
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { authApi } from '../../api/endpoints/auth'

const schema = z.object({ email: z.string().email() })
type FormValues = z.infer<typeof schema>

export function ForgotPasswordPage() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const mutation = useMutation({
    mutationFn: (data: FormValues) => authApi.forgotPassword(data.email),
  })

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
        background: 'radial-gradient(circle at 15% 15%, #DCFCE7 0%, #F0FDF4 35%, #ECFDF5 100%)',
      }}
    >
      <Paper
        elevation={0}
        sx={{ p: 5, width: '100%', maxWidth: 420, borderRadius: 4, boxShadow: '0 30px 60px -20px rgba(6, 78, 59, 0.35)' }}
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
              background: 'linear-gradient(135deg, #34D399 0%, #059669 100%)',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.45)',
            }}
          >
            <StorefrontRounded sx={{ color: '#052E20', fontSize: 20 }} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            Dukani
          </Typography>
        </Box>

        <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.5 }}>
          Forgot your password?
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Enter your account email and we'll send you a link to reset it.
        </Typography>

        {mutation.isSuccess ? (
          <Alert severity="success">{mutation.data.message}</Alert>
        ) : (
          <form onSubmit={handleSubmit((data) => mutation.mutate(data))}>
            <Stack spacing={2}>
              <TextField label="Email" type="email" fullWidth autoFocus {...register('email')} error={!!errors.email} helperText={errors.email?.message} />
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
                  background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
                  '&:hover': { background: 'linear-gradient(135deg, #047857 0%, #059669 100%)' },
                }}
              >
                Send reset link
              </Button>
            </Stack>
          </form>
        )}

        <Typography variant="body2" sx={{ mt: 3, textAlign: 'center' }} color="text.secondary">
          <Link to="/login" style={{ color: '#059669', fontWeight: 600, textDecoration: 'none' }}>
            Back to sign in
          </Link>
        </Typography>
      </Paper>
    </Box>
  )
}
