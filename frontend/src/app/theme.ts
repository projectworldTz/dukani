import { createTheme } from '@mui/material/styles'

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#166534' },
    secondary: { main: '#b45309' },
    background: { default: '#f6f7f9', paper: '#ffffff' },
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
        root: { boxShadow: '0 1px 2px rgba(16,24,40,0.06), 0 1px 3px rgba(16,24,40,0.1)' },
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
