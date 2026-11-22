import {
  ArrowForward,
  Inventory2,
  PointOfSale,
  Receipt,
  Assessment,
  Groups,
  LocalShipping,
} from '@mui/icons-material'
import { Box, Button, Card, CardActionArea, Container, Grid, Paper, Stack, Typography } from '@mui/material'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BUSINESS_CATEGORIES } from '../../constants/businessCategories'

const FEATURES = [
  { icon: PointOfSale, label: 'Fast checkout', description: 'Barcode scan, split payments, held sales' },
  { icon: Inventory2, label: 'Inventory & purchasing', description: 'Stock levels, suppliers, transfers, counts' },
  { icon: Receipt, label: 'Receipts & quotations', description: 'Printable, shareable, professional documents' },
  { icon: Groups, label: 'Staff & permissions', description: 'Roles, approval limits, multi-branch' },
  { icon: Assessment, label: 'Reports', description: 'Sales trends, profit, tax, low stock' },
  { icon: LocalShipping, label: 'Multi-branch', description: 'Run one business across many locations' },
]

export function LandingPage() {
  const navigate = useNavigate()
  const [selected, setSelected] = useState<string | null>(null)

  function goToRegister() {
    navigate('/register', { state: selected ? { category: selected } : undefined })
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Box sx={{ borderBottom: '1px solid #e5e7eb', bgcolor: 'background.paper' }}>
        <Container maxWidth="lg">
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', py: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 800 }} color="primary.main">
              Dukani
            </Typography>
            <Button component={Link} to="/login" variant="outlined">
              Sign in
            </Button>
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ pt: { xs: 5, md: 8 }, pb: 4 }}>
        <Stack spacing={2} sx={{ textAlign: 'center', maxWidth: 720, mx: 'auto' }}>
          <Typography variant="h3" sx={{ fontWeight: 800, fontSize: { xs: 28, md: 40 } }}>
            One POS for every kind of business
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ fontSize: 18 }}>
            Retail, restaurants, pharmacies, electronics, salons, hardware stores, wholesale — Dukani
            adapts to how you sell, not the other way around.
          </Typography>
        </Stack>
      </Container>

      <Container maxWidth="lg" sx={{ pb: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5, textAlign: 'center' }}>
          What kind of business do you run?
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
          Pick the closest match — you can change this anytime later.
        </Typography>

        <Grid container spacing={1.5}>
          {BUSINESS_CATEGORIES.map((category) => {
            const Icon = category.icon
            const isSelected = selected === category.value
            return (
              <Grid size={{ xs: 6, sm: 4, md: 3 }} key={category.value}>
                <Card
                  variant="outlined"
                  sx={{
                    height: '100%',
                    borderColor: isSelected ? 'primary.main' : undefined,
                    borderWidth: isSelected ? 2 : 1,
                    bgcolor: isSelected ? 'rgba(37, 99, 235, 0.06)' : undefined,
                  }}
                >
                  <CardActionArea onClick={() => setSelected(category.value)} sx={{ p: 2, height: '100%' }}>
                    <Stack spacing={1} sx={{ alignItems: 'flex-start' }}>
                      <Icon color={isSelected ? 'primary' : 'action'} />
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {category.label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {category.description}
                      </Typography>
                    </Stack>
                  </CardActionArea>
                </Card>
              </Grid>
            )
          })}
        </Grid>

        <Stack direction="row" sx={{ justifyContent: 'center', mt: 4 }}>
          <Button variant="contained" size="large" endIcon={<ArrowForward />} onClick={goToRegister}>
            {selected ? `Register now — ${selected}` : 'Register now'}
          </Button>
        </Stack>
      </Container>

      <Box sx={{ bgcolor: 'background.paper', borderTop: '1px solid #e5e7eb', mt: 6, py: 6 }}>
        <Container maxWidth="lg">
          <Grid container spacing={3}>
            {FEATURES.map((feature) => {
              const Icon = feature.icon
              return (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={feature.label}>
                  <Paper variant="outlined" sx={{ p: 2.5, height: '100%' }}>
                    <Icon color="primary" sx={{ mb: 1 }} />
                    <Typography variant="body1" sx={{ fontWeight: 700 }}>
                      {feature.label}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {feature.description}
                    </Typography>
                  </Paper>
                </Grid>
              )
            })}
          </Grid>
        </Container>
      </Box>

      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Already have an account? <Link to="/login">Sign in</Link>
        </Typography>
      </Box>
    </Box>
  )
}
