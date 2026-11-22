import { CalculateRounded, CloseRounded, ContentCopyRounded, DeleteSweepRounded, HistoryRounded, ReplayRounded } from '@mui/icons-material'
import { Box, Button, Drawer, IconButton, Stack, Tab, Tabs, ThemeProvider, Tooltip, Typography, createTheme, useMediaQuery, useTheme } from '@mui/material'
import { useEffect, useMemo } from 'react'
import { useToastStore } from '../../stores/toastStore'
import { BusinessTools } from './BusinessTools'
import { useCalculatorStore, type CalculatorTab } from './calculatorStore'
import { StandardCalculator } from './StandardCalculator'

function RecentList() {
  const { history, clearHistory, loadExpression } = useCalculatorStore()
  if (history.length === 0) {
    return (
      <Box sx={{ py: 8, textAlign: 'center', color: 'text.secondary' }}>
        <HistoryRounded sx={{ fontSize: 48, opacity: 0.35 }} />
        <Typography sx={{ fontWeight: 700, color: 'text.primary', mt: 1 }}>No calculations yet</Typography>
        <Typography variant="body2">Answers from “=” and saved business results appear here until you close this browser tab.</Typography>
      </Box>
    )
  }
  return (
    <Box>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="body2" color="text.secondary">
          This session · {history.length} calculation{history.length === 1 ? '' : 's'}
        </Typography>
        <Button size="small" color="inherit" startIcon={<DeleteSweepRounded />} onClick={clearHistory}>
          Clear
        </Button>
      </Stack>
      <Stack spacing={1}>
        {history.map((h) => (
          <Box key={h.id} sx={{ p: 1.75, borderRadius: '14px', border: '1px solid', borderColor: 'divider', bgcolor: '#fff' }}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'primary.main', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h.title}</Typography>
              <Typography variant="caption" color="text.disabled">
                {new Date(h.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, wordBreak: 'break-word' }}>
              {h.detail}
            </Typography>
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mt: 0.5, gap: 1 }}>
              <Typography sx={{ fontWeight: 800, fontSize: 18, wordBreak: 'break-word' }}>{h.title === 'Standard' ? `= ${h.result}` : h.result}</Typography>
              <Stack direction="row">
                <Tooltip title="Use this number in the calculator">
                  <IconButton size="small" onClick={() => loadExpression(String(h.value))} aria-label="Use in calculator">
                    <ReplayRounded fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Copy">
                  <IconButton
                    size="small"
                    aria-label="Copy result"
                    onClick={async () => {
                      await navigator.clipboard?.writeText(String(h.value)).catch(() => undefined)
                      useToastStore.getState().show('Copied.', 'success')
                    }}
                  >
                    <ContentCopyRounded fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Stack>
          </Box>
        ))}
      </Stack>
    </Box>
  )
}

/**
 * The calculator slides in over whatever screen the user is on (a sale in progress,
 * a product list…) and slides away again — nothing is lost underneath.
 * Opens from the header button, the dashboard, or F9.
 */
export function CalculatorPanel() {
  const theme = useTheme()
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'))
  const { open, setOpen, toggle, tab, setTab } = useCalculatorStore()
  // The calculator has its own green identity so it stands out from the blue app around it.
  const greenTheme = useMemo(() => createTheme(theme, { palette: { primary: { main: '#16A34A', dark: '#15803D', light: '#4ADE80', contrastText: '#FFFFFF' } } }), [theme])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'F9') {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle])

  return (
    <ThemeProvider theme={greenTheme}>
    <Drawer
      anchor={isPhone ? 'bottom' : 'right'}
      open={open}
      onClose={() => setOpen(false)}
      slotProps={{
        paper: {
          sx: {
            width: { xs: '100%', sm: 440 },
            height: { xs: '94dvh', sm: '100%' },
            borderTopLeftRadius: { xs: 20, sm: 20 },
            borderBottomLeftRadius: { xs: 0, sm: 20 },
            borderTopRightRadius: { xs: 20, sm: 0 },
            bgcolor: '#F3FAF5',
            display: 'flex',
            flexDirection: 'column',
          },
        },
      }}
    >
      <Box sx={{ px: 2.5, pt: 2, pb: 1, bgcolor: '#fff', borderBottom: '1px solid', borderColor: 'divider' }}>
        {isPhone && <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: '#CBD5E1', mx: 'auto', mb: 1.5 }} />}
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
            <Box sx={{ width: 38, height: 38, borderRadius: '11px', bgcolor: '#16A34A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(22,163,74,0.35)' }}>
              <CalculateRounded />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: 18, lineHeight: 1.2 }}>Calculator</Typography>
              <Typography variant="caption" color="text.secondary">
                Quick sums and shop maths{isPhone ? '' : ' · F9'}
              </Typography>
            </Box>
          </Stack>
          <IconButton onClick={() => setOpen(false)} aria-label="Close calculator">
            <CloseRounded />
          </IconButton>
        </Stack>
        <Tabs
          value={tab}
          onChange={(_, v: CalculatorTab) => setTab(v)}
          variant="fullWidth"
          sx={{ minHeight: 40, '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, minHeight: 40, fontSize: 14.5 } }}
        >
          <Tab value="standard" label="Standard" />
          <Tab value="business" label="Business" />
          <Tab value="recent" label="Recent" />
        </Tabs>
      </Box>
      <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2.5, pb: 'calc(20px + env(safe-area-inset-bottom))' }}>
        {/* Standard stays mounted so the current sum survives switching tabs. */}
        <Box sx={{ display: tab === 'standard' ? 'block' : 'none' }}>
          <StandardCalculator active={open && tab === 'standard'} />
        </Box>
        {tab === 'business' && <BusinessTools />}
        {tab === 'recent' && <RecentList />}
      </Box>
    </Drawer>
    </ThemeProvider>
  )
}
