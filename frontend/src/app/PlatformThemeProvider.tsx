import { ThemeProvider, createTheme } from '@mui/material'
import { useMemo, type ReactNode } from 'react'
import { usePlatform } from '../hooks/usePlatform'
import { theme } from './theme'

/** The pharmacy platform has its own teal identity; the general POS stays blue. */
const pharmacyTheme = createTheme(theme, {
  palette: { primary: { main: '#0D9488', dark: '#0F766E', light: '#5EEAD4', contrastText: '#FFFFFF' } },
})

/** Butchery: a deep meat red — warm, but distinct from the error red used for alerts. */
const butcheryTheme = createTheme(theme, {
  palette: { primary: { main: '#9F1239', dark: '#881337', light: '#FB7185', contrastText: '#FFFFFF' } },
})

export function PlatformThemeProvider({ children }: { children: ReactNode }) {
  const { isPharmacy, isButchery } = usePlatform()
  const active = useMemo(() => (isPharmacy ? pharmacyTheme : isButchery ? butcheryTheme : theme), [isPharmacy, isButchery])
  return <ThemeProvider theme={active}>{children}</ThemeProvider>
}
