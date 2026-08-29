import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuthUser } from '../types'

interface AuthState {
  token: string | null
  user: AuthUser | null
  setAuth: (token: string, user: AuthUser) => void
  setUser: (user: AuthUser) => void
  clear: () => void
  hasPermission: (permission: string) => boolean
  hasRole: (role: string) => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      setUser: (user) => set({ user }),
      clear: () => set({ token: null, user: null }),
      hasPermission: (permission) => get().user?.permissions.includes(permission) ?? false,
      hasRole: (role) => get().user?.roles.includes(role) ?? false,
    }),
    { name: 'dukani-auth' },
  ),
)
