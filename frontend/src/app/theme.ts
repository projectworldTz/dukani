import { createTheme } from '@mui/material/styles'

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#2563EB', dark: '#1D4ED8', light: '#60A5FA', contrastText: '#FFFFFF' },
    secondary: { main: '#F59E0B', contrastText: '#FFFFFF' },
    success: { main: '#16A34A' },
    warning: { main: '#F59E0B' },
    error: { main: '#EF4444' },
    background: { default: '#F4F7FC', paper: '#FFFFFF' },
    text: { primary: '#0F172A', secondary: '#64748B' },
    divider: '#E6EBF2',
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: '"Inter", "Segoe UI", Roboto, sans-serif',
    h1: { fontWeight: 700 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 700 },
    h4: { fontWeight: 700 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600, borderRadius: 8 },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: { boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 2px 8px rgba(15,23,42,0.04)', borderRadius: 12 },
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: { maxWidth: '100%', overflowX: 'auto' },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: { gap: 8 },
      },
    },
  },
})
