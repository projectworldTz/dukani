import { CssBaseline, ThemeProvider } from '@mui/material'
import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.tsx'
import { queryClient } from './app/queryClient'
import { theme } from './app/theme'
import './index.css'
import { useToastStore } from './stores/toastStore'

registerSW({
  immediate: true,
  onNeedRefresh() {
    useToastStore.getState().show('A new version of Dukani is ready — refresh to update.', 'info')
  },
  onOfflineReady() {
    useToastStore.getState().show('Dukani is installed. An internet connection is still needed for sales and data.', 'success')
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
