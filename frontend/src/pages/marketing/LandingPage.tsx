import {
  ArrowForward,
  Assessment,
  Calculate,
  ExpandMore,
  Groups,
  Inventory2,
  LocalPharmacy,
  PeopleAlt,
  PointOfSale,
  Receipt,
  SetMeal,
  Storefront,
  Store,
} from '@mui/icons-material'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Card,
  CardActionArea,
  Container,
  Grid,
  Paper,
  Stack,
  Typography,
  type SvgIconProps,
} from '@mui/material'
import { useState, type ComponentType } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BUSINESS_CATEGORIES } from '../../constants/businessCategories'
import { FAQ, FEATURES, HERO, PLATFORMS } from '../../content/landing'

const FEATURE_ICONS: Record<(typeof FEATURES)[number]['key'], ComponentType<SvgIconProps>> = {
  checkout: PointOfSale,
  stock: Inventory2,
  profit: Assessment,
  staff: Groups,
  customers: PeopleAlt,
  branches: Store,
  efd: Receipt,
  calculator: Calculate,
}

const PLATFORM_STYLE: Record<(typeof PLATFORMS)[number]['key'], { icon: ComponentType<SvgIconProps>; color: string; bg: string }> = {
  pharmacy: { icon: LocalPharmacy, color: '#0F766E', bg: '#F0FDFA' },
  butchery: { icon: SetMeal, color: '#9F1239', bg: '#FFF1F2' },
  retail: { icon: Storefront, color: '#2563EB', bg: '#EFF6FF' },
}

/**
 * Public home page. Its words live in src/content/landing.ts, which is also baked into
 * index.html at build time for search engines — edit the text there, not here.
 */
export function LandingPage() {
  const navigate = useNavigate()
  const [selected, setSelected] = useState<string | null>(null)

  function goToRegister() {
    navigate('/register', { state: selected ? { category: selected } : undefined })
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Box component="header" sx={{ borderBottom: '1px solid #e5e7eb', bgcolor: 'background.paper' }}>
        <Container maxWidth="lg">
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', py: 2 }}>
            <Typography sx={{ fontWeight: 800, fontSize: 20 }} color="primary.main">
              Dukani
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button component={Link} to="/login" variant="outlined">
                Sign in
              </Button>
              <Button component={Link} to="/register" variant="contained" sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
                Free trial
              </Button>
            </Stack>
          </Stack>
        </Container>
      </Box>

      <Box component="main">
        <Container maxWidth="lg" sx={{ pt: { xs: 5, md: 8 }, pb: 4 }}>
          <Stack spacing={2} sx={{ textAlign: 'center', maxWidth: 820, mx: 'auto' }}>
            <Typography color="primary.main" sx={{ fontWeight: 700 }}>
              {HERO.eyebrow}
            </Typography>
            <Typography component="h1" variant="h3" sx={{ fontWeight: 800, fontSize: { xs: 28, md: 42 }, lineHeight: 1.2 }}>
              {HERO.title}
            </Typography>
            <Typography color="text.secondary" sx={{ fontSize: { xs: 16, md: 18 } }}>
              {HERO.subtitle}
            </Typography>
            <Typography lang="sw" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              {HERO.swahili}
            </Typography>
          </Stack>
        </Container>

        <Container maxWidth="lg" sx={{ pb: 3 }}>
          <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5, textAlign: 'center' }}>
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

          <Stack sx={{ alignItems: 'center', mt: 4, gap: 1 }}>
            <Button variant="contained" size="large" endIcon={<ArrowForward />} onClick={goToRegister}>
              {selected ? `Register now — ${selected}` : HERO.cta}
            </Button>
            <Typography variant="caption" color="text.secondary">
              14 days free · no payment needed to start
            </Typography>
          </Stack>
        </Container>

        <Box component="section" sx={{ bgcolor: 'background.paper', borderTop: '1px solid #e5e7eb', mt: 6, py: { xs: 5, md: 7 } }}>
          <Container maxWidth="lg">
            <Typography component="h2" variant="h5" sx={{ fontWeight: 800, textAlign: 'center', mb: 4 }}>
              Everything you need to run your business
            </Typography>
            <Grid container spacing={2.5}>
              {FEATURES.map((feature) => {
                const Icon = FEATURE_ICONS[feature.key]
                return (
                  <Grid size={{ xs: 12, sm: 6, md: 3 }} key={feature.key}>
                    <Paper variant="outlined" sx={{ p: 2.5, height: '100%', borderRadius: 3 }}>
                      <Icon color="primary" sx={{ mb: 1 }} />
                      <Typography component="h3" sx={{ fontWeight: 700, mb: 0.5 }}>
                        {feature.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {feature.text}
                      </Typography>
                    </Paper>
                  </Grid>
                )
              })}
            </Grid>
          </Container>
        </Box>

        <Box component="section" sx={{ py: { xs: 5, md: 7 } }}>
          <Container maxWidth="lg">
            <Typography component="h2" variant="h5" sx={{ fontWeight: 800, textAlign: 'center', mb: 4 }}>
              Built for your kind of business
            </Typography>
            <Grid container spacing={2.5}>
              {PLATFORMS.map((platform) => {
                const style = PLATFORM_STYLE[platform.key]
                const Icon = style.icon
                return (
                  <Grid size={{ xs: 12, md: 4 }} key={platform.key}>
                    <Paper variant="outlined" sx={{ p: 3, height: '100%', borderRadius: 3, bgcolor: style.bg, borderColor: 'transparent' }}>
                      <Icon sx={{ color: style.color, fontSize: 32, mb: 1 }} />
                      <Typography component="h3" variant="h6" sx={{ fontWeight: 800, color: style.color, mb: 1 }}>
                        {platform.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {platform.text}
                      </Typography>
                    </Paper>
                  </Grid>
                )
              })}
            </Grid>
          </Container>
        </Box>

        <Box component="section" sx={{ bgcolor: 'background.paper', borderTop: '1px solid #e5e7eb', py: { xs: 5, md: 7 } }}>
          <Container maxWidth="md">
            <Typography component="h2" variant="h5" sx={{ fontWeight: 800, textAlign: 'center', mb: 3 }}>
              Frequently asked questions
            </Typography>
            {FAQ.map((item) => (
              <Accordion key={item.q} disableGutters variant="outlined" sx={{ '&:not(:last-of-type)': { borderBottom: 0 } }}>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography component="h3" sx={{ fontWeight: 700 }}>
                    {item.q}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography color="text.secondary">{item.a}</Typography>
                </AccordionDetails>
              </Accordion>
            ))}
            <Stack sx={{ alignItems: 'center', mt: 4 }}>
              <Button component={Link} to="/register" variant="contained" size="large" endIcon={<ArrowForward />}>
                {HERO.cta}
              </Button>
            </Stack>
          </Container>
        </Box>
      </Box>

      <Box component="footer" sx={{ py: 4, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Already have an account? <Link to="/login">Sign in</Link>
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Dukani by Project World Tanzania
        </Typography>
      </Box>
    </Box>
  )
}
