import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type CalculatorTab = 'standard' | 'business' | 'recent'

export interface HistoryEntry {
  id: string
  at: number
  /** "Standard" or the business tool's name. */
  title: string
  /** What was calculated, e.g. "12 × 5" or "Buy 700 · Sell 1,000 · Qty 24". */
  detail: string
  /** The headline answer, already formatted for display. */
  result: string
  /** Raw number, so a result can be reused in the Standard calculator. */
  value: number
}

interface CalculatorState {
  open: boolean
  tab: CalculatorTab
  history: HistoryEntry[]
  /** Set when a recent result is sent back into the Standard calculator. */
  pendingExpression: string | null
  setOpen: (open: boolean) => void
  toggle: () => void
  setTab: (tab: CalculatorTab) => void
  addHistory: (entry: Omit<HistoryEntry, 'id' | 'at'>) => void
  clearHistory: () => void
  loadExpression: (expression: string) => void
  takePendingExpression: () => string | null
}

const MAX_HISTORY = 30

/**
 * Shared calculator state. Recent calculations live in sessionStorage: they survive a
 * page refresh but disappear when the browser tab closes ("during the session").
 */
export const useCalculatorStore = create<CalculatorState>()(
  persist(
    (set, get) => ({
      open: false,
      tab: 'standard',
      history: [],
      pendingExpression: null,
      setOpen: (open) => set({ open }),
      toggle: () => set({ open: !get().open }),
      setTab: (tab) => set({ tab }),
      addHistory: (entry) => {
        const last = get().history[0]
        // Don't record the same answer twice in a row (e.g. pressing "=" repeatedly).
        if (last && last.title === entry.title && last.detail === entry.detail && last.result === entry.result) return
        set({ history: [{ ...entry, id: crypto.randomUUID(), at: Date.now() }, ...get().history].slice(0, MAX_HISTORY) })
      },
      clearHistory: () => set({ history: [] }),
      loadExpression: (expression) => set({ pendingExpression: expression, tab: 'standard' }),
      takePendingExpression: () => {
        const e = get().pendingExpression
        if (e !== null) set({ pendingExpression: null })
        return e
      },
    }),
    {
      name: 'dukani-calculator',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({ history: s.history, tab: s.tab }),
    },
  ),
)
