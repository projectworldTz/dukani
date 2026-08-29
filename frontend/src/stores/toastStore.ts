import { create } from 'zustand'

export type ToastSeverity = 'success' | 'error' | 'info' | 'warning'

export interface ToastItem {
  id: number
  message: string
  severity: ToastSeverity
}

interface ToastState {
  toasts: ToastItem[]
  show: (message: string, severity?: ToastSeverity) => void
  dismiss: (id: number) => void
}

let nextId = 1

export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],
  show: (message, severity = 'info') =>
    set((state) => ({ toasts: [...state.toasts, { id: nextId++, message, severity }] })),
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))
