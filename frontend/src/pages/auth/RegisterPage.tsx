import { zodResolver } from '@hookform/resolvers/zod'
import { GroupsRounded, ReceiptLongRounded, SecurityRounded, StorefrontRounded } from '@mui/icons-material'
import { Alert, Box, Button, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { authApi } from '../../api/endpoints/auth'
import { BUSINESS_CATEGORIES } from '../../constants/businessCategories'
import { useAuthStore } from '../../stores/authStore'

const schema = z
  .object({
    business_name: z.string().min(2, 'Business name is required'),
    owner_name: z.string().min(2, 'Your name is required'),
    email: z.string().email(),
    phone: z.string().trim().refine((v) => v.replace(/\D/g, '').length >= 9, 'Enter your phone number so we can help you get started'),
    password: z.string().min(8, 'At least 8 characters'),
    password_confirmation: z.string(),
  })
  .refine((data) => data.password === data.password_confirmation, {
    message: 'Passwords do not match',
    path: ['password_confirmation'],
  })

type FormValues = z.infer<typeof schema>

const HIGHLIGHTS = [
  { icon: <StorefrontRounded fontSize="small" />, text: 'Built for any business — retail, pharmacy, restaurant, and more' },
  { icon: <GroupsRounded fontSize="small" />, text: 'Invite staff with role-based access from day one' },
  { icon: <ReceiptLongRounded fontSize="small" />, text: 'Professional receipts and quotations, ready to print' },
  { icon: <SecurityRounded fontSize="small" />, text: 'Your data stays isolated to your business, always' },
]

export function RegisterPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const setAuth = useAuthStore((s) => s.setAuth)
  const preselectedCategory = (location.state as { category?: string } | null)?.category
  const [category, setCategory] = useState(preselectedCategory ?? '')
  const [customCategory, setCustomCategory] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      authApi.register({ ...data, business_category: category === 'Other' ? customCategory || 'Other' : category || undefined }),
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
        py: { xs: 1, sm: 4 },
        background: 'radial-gradient(circle at 15% 15%, #DBEAFE 0%, #EFF6FF 35%, #EFF6FF 100%)',
      }}
    >
      <Paper
        elevation={0}
        sx={{
          display: 'flex',
          width: '100%',
          maxWidth: 1000,
          borderRadius: 4,
          overflow: 'hidden',
          boxShadow: '0 30px 60px -20px rgba(30, 58, 138, 0.35)',
        }}
      >
        {/* Branding panel */}
        <Box
          sx={{
            flex: '1 1 42%',
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
              Start selling in minutes.
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(219, 234, 254, 0.8)' }}>
              Create your business account and get a fully working POS, inventory, and reporting system instantly.
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
            flex: '1 1 58%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            p: { xs: 2.5, sm: 6 },
            bgcolor: '#FFFFFF',
            maxHeight: '100dvh',
            overflowY: 'auto',
          }}
        >
          <Box sx={{ maxWidth: 400, width: '100%', mx: 'auto' }}>
            <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.5 }}>
              Create your business
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              You'll be signed in as the Business Owner.
            </Typography>

            {mutation.isError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {(mutation.error as any)?.response?.data?.message ?? 'Registration failed. Check the fields below.'}
              </Alert>
            )}

            <form onSubmit={handleSubmit((data) => mutation.mutate(data))}>
              <Stack spacing={2}>
                <TextField
                  label="Business name"
                  fullWidth
                  {...register('business_name')}
                  error={!!errors.business_name}
                  helperText={errors.business_name?.message}
                />
                <TextField select label="Business type" value={category} onChange={(e) => setCategory(e.target.value)} fullWidth>
                  <MenuItem value="">Prefer not to say</MenuItem>
                  {BUSINESS_CATEGORIES.map((c) => (
                    <MenuItem key={c.value} value={c.value}>
                      {c.label}
                    </MenuItem>
                  ))}
                </TextField>
                {category === 'Pharmacy & Health' && (
                  <Alert severity="success" icon={false} sx={{ bgcolor: '#F0FDFA', border: '1px solid #99F6E4' }}>
                    <strong>You'll get Dukani Pharmacy</strong> — built for medicines: batch &amp; expiry tracking (sells nearest expiry first), prescription records,
                    dosage labels on receipts and a controlled drugs register.
                  </Alert>
                )}
                {category === 'Butchery & Fresh Foods' && (
                  <Alert severity="success" icon={false} sx={{ bgcolor: '#FFF1F2', border: '1px solid #FECDD3' }}>
                    <strong>You'll get Dukani Butchery</strong> — sell by weight (kg) or by amount, a daily price board, carcass cutting with
                    yield and real cost per kg, and waste tracking.
                  </Alert>
                )}
                {category === 'Other' && (
                  <TextField
                    label="Tell us what kind of business"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    fullWidth
                  />
                )}
                <TextField
                  label="Your name"
                  fullWidth
                  {...register('owner_name')}
                  error={!!errors.owner_name}
                  helperText={errors.owner_name?.message}
                />
                <TextField
                  label="Email"
                  type="email"
                  fullWidth
                  {...register('email')}
                  error={!!errors.email}
                  helperText={errors.email?.message}
                />
                <TextField
                  label="Phone number"
                  type="tel"
                  placeholder="0712 345 678"
                  fullWidth
                  {...register('phone')}
                  error={!!errors.phone}
                  helperText={errors.phone?.message ?? 'We will call to help you set up during your free trial.'}
                  slotProps={{ htmlInput: { inputMode: 'tel', autoComplete: 'tel' } }}
                />
                <TextField
                  label="Password"
                  type="password"
                  fullWidth
                  {...register('password')}
                  error={!!errors.password}
                  helperText={errors.password?.message}
                />
                <TextField
                  label="Confirm password"
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
                    boxShadow: '0 8px 20px -6px rgba(29, 78, 216, 0.55)',
                    '&:hover': { background: 'linear-gradient(135deg, #1D4ED8 0%, #2563EB 100%)' },
                  }}
                >
                  Create business
                </Button>
                <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
                  Free for 14 days — no payment needed to start.
                </Typography>
              </Stack>
            </form>

            <Typography variant="body2" sx={{ mt: 3, textAlign: 'center' }} color="text.secondary">
              Already have an account?{' '}
              <Link to="/login" style={{ color: '#2563EB', fontWeight: 600, textDecoration: 'none' }}>
                Sign in
              </Link>
            </Typography>
          </Box>
        </Box>
      </Paper>
    </Box>
  )
}
