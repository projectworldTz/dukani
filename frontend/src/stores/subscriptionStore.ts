import { create } from 'zustand'
import type { SubscriptionInfo } from '../types'

interface SubscriptionState {
  /** Set when the API answers 402 "subscription_expired" — the app then shows the "trial ended" screen. */
  ended: { message: string; subscription: SubscriptionInfo | null } | null
  setEnded: (ended: SubscriptionState['ended']) => void
}

export const useSubscriptionStore = create<SubscriptionState>()((set) => ({
  ended: null,
  setEnded: (ended) => set({ ended }),
}))
