import { api } from '../client'
import type { AuthUser } from '../../types'

export interface RegisterPayload {
  business_name: string
  business_category?: string
  owner_name: string
  email: string
  phone?: string
  password: string
  password_confirmation: string
  currency?: string
}

export interface LoginPayload {
  email: string
  password: string
}

interface AuthResponse {
  token: string
  user: AuthUser
}

export interface Session {
  id: number
  name: string
  last_used_at: string | null
  created_at: string
  is_current: boolean
}

export const authApi = {
  register: (payload: RegisterPayload) => api.post<AuthResponse>('/auth/register', payload).then((r) => r.data),
  login: (payload: LoginPayload) => api.post<AuthResponse>('/auth/login', payload).then((r) => r.data),
  logout: () => api.post('/auth/logout'),
  // JsonResource responses are wrapped in `data` unless wrapping is disabled server-side.
  me: () => api.get<AuthUser | { data: AuthUser }>('/auth/me').then((r) => ('data' in r.data ? r.data.data : r.data)),
  forgotPassword: (email: string) => api.post<{ message: string }>('/auth/forgot-password', { email }).then((r) => r.data),
  resetPassword: (payload: { email: string; token: string; password: string; password_confirmation: string }) =>
    api.post<{ message: string }>('/auth/reset-password', payload).then((r) => r.data),
  verifyEmail: (payload: { email: string; token: string }) =>
    api.post<{ message: string }>('/auth/email/verify', payload).then((r) => r.data),
  resendVerification: () => api.post<{ message: string }>('/auth/email/resend').then((r) => r.data),
  sessions: () => api.get<Session[]>('/auth/sessions').then((r) => r.data),
  revokeSession: (id: number) => api.delete(`/auth/sessions/${id}`).then((r) => r.data),
}
