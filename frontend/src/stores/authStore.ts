import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuthUser } from '../types'

interface StashedSession {
  token: string
  user: AuthUser
}

interface AuthState {
  token: string | null
  user: AuthUser | null
  /** The Platform Admin's own session, stashed while "viewing as" a business owner — null when not impersonating. */
  adminSession: StashedSession | null
  setAuth: (token: string, user: AuthUser) => void
  setUser: (user: AuthUser) => void
  clear: () => void
  hasPermission: (permission: string) => boolean
  hasRole: (role: string) => boolean
  startImpersonation: (token: string, user: AuthUser) => void
  exitImpersonation: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      adminSession: null,
      setAuth: (token, user) => set({ token, user }),
      setUser: (user) => set({ user }),
      clear: () => set({ token: null, user: null, adminSession: null }),
      hasPermission: (permission) => get().user?.permissions.includes(permission) ?? false,
      hasRole: (role) => get().user?.roles.includes(role) ?? false,
      startImpersonation: (token, user) => {
        const { token: adminToken, user: adminUser } = get()
        if (!adminToken || !adminUser) return
        set({ adminSession: { token: adminToken, user: adminUser }, token, user })
      },
      exitImpersonation: () => {
        const { adminSession } = get()
        if (!adminSession) return
        set({ token: adminSession.token, user: adminSession.user, adminSession: null })
      },
    }),
    { name: 'dukani-auth' },
  ),
)
