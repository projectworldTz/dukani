import { Alert, Snackbar } from '@mui/material'
import { useToastStore } from '../../stores/toastStore'

/** One global mount point (see App.tsx) — every mutation across the app reports
 * success/error here via the MutationCache hooks in app/queryClient.ts, so no page
 * needs to render its own snackbar. Shows one toast at a time, queued in order. */
export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)
  const current = toasts[0]

  return (
    <Snackbar
      key={current?.id}
      open={!!current}
      autoHideDuration={4000}
      onClose={() => current && dismiss(current.id)}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      {current && (
        <Alert onClose={() => dismiss(current.id)} severity={current.severity} variant="filled" sx={{ width: '100%' }}>
          {current.message}
        </Alert>
      )}
    </Snackbar>
  )
}
