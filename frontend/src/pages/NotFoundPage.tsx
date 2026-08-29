import { StorefrontRounded } from '@mui/icons-material'
import { Box, Button, Paper, Typography } from '@mui/material'
import { Link } from 'react-router-dom'

export function NotFoundPage() {
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
        sx={{ p: 5, width: '100%', maxWidth: 420, borderRadius: 4, boxShadow: '0 30px 60px -20px rgba(6, 78, 59, 0.35)', textAlign: 'center' }}
      >
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #34D399 0%, #059669 100%)',
            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.45)',
            mx: 'auto',
            mb: 3,
          }}
        >
          <StorefrontRounded sx={{ color: '#052E20', fontSize: 28 }} />
        </Box>
        <Typography variant="h3" sx={{ fontWeight: 800, mb: 1 }}>
          404
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          This page doesn't exist, or you don't have access to it.
        </Typography>
        <Button
          component={Link}
          to="/"
          variant="contained"
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
            '&:hover': { background: 'linear-gradient(135deg, #047857 0%, #059669 100%)' },
          }}
        >
          Go back home
        </Button>
      </Paper>
    </Box>
  )
}
