import { MutationCache, QueryClient } from '@tanstack/react-query'
import { useToastStore } from '../stores/toastStore'

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: {
      /** Toast shown on success. Omit to stay silent (e.g. background/read-like mutations). */
      successMessage?: string
      /** Set true to skip the automatic error toast — for mutations that already render their own inline error UI. */
      suppressErrorToast?: boolean
    }
  }
}

function extractErrorMessage(error: unknown): string {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
  return message ?? 'Something went wrong. Please try again.'
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
  // Central place for the "toast on every save/delete/update" behavior — see
  // ToastHost.tsx for the render side. Individual mutations opt into a specific
  // success message via `meta.successMessage`; errors toast automatically
  // everywhere unless a mutation opts out with `meta.suppressErrorToast`.
  mutationCache: new MutationCache({
    onSuccess: (_data, _variables, _context, mutation) => {
      const message = mutation.meta?.successMessage
      if (message) useToastStore.getState().show(message, 'success')
    },
    onError: (error, _variables, _context, mutation) => {
      if (mutation.meta?.suppressErrorToast) return
      useToastStore.getState().show(extractErrorMessage(error), 'error')
    },
  }),
})
