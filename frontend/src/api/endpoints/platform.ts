import { api } from '../client'
import type { AppNotification } from './notifications'

export interface PlatformBusiness {
  id: number
  name: string
  category: string | null
  slug: string
  currency: string
  plan: string | null
  status: 'active' | 'suspended'
  users_count: number
  license_expires_at: string | null
  deleted_at: string | null
  deletion_reason: string | null
}

export interface PlatformBusinessDetail {
  id: number
  name: string
  slug: string
  category: string | null
  currency: string
  timezone: string
  plan: string | null
  status: 'active' | 'suspended'
  license_expires_at: string | null
  deleted_at: string | null
  deletion_reason: string | null
  created_at: string
  staff_count: number
  branches: { id: number; name: string; code: string; is_main: boolean; status: string }[]
  owner: { name: string; email: string; phone: string | null; joined_at: string } | null
}

export const platformApi = {
  businesses: (trashed = false) =>
    api.get<{ data: PlatformBusiness[] }>('/platform/businesses', { params: trashed ? { trashed: 1 } : undefined }).then((r) => r.data.data),
  business: (id: number) => api.get<PlatformBusinessDetail>(`/platform/businesses/${id}`).then((r) => r.data),
  updateStatus: (id: number, status: 'active' | 'suspended') =>
    api.put(`/platform/businesses/${id}/status`, { status }).then((r) => r.data),
  extendLicense: (id: number, months: 6 | 12) =>
    api.post(`/platform/businesses/${id}/extend-license`, { months }).then((r) => r.data),
  deleteBusiness: (id: number, reason: string) =>
    api.delete<{ message: string }>(`/platform/businesses/${id}`, { data: { reason } }).then((r) => r.data),
  restoreBusiness: (id: number, reason: string) =>
    api.post(`/platform/businesses/${id}/restore`, { reason }).then((r) => r.data),
  stats: () => api.get('/platform/stats').then((r) => r.data),
  notifications: {
    list: (unreadOnly = false) =>
      api.get<AppNotification[]>('/platform/notifications', { params: { unread_only: unreadOnly } }).then((r) => r.data),
    markRead: (id: number) => api.post(`/platform/notifications/${id}/read`).then((r) => r.data),
    markAllRead: () => api.post('/platform/notifications/read-all').then((r) => r.data),
  },
}
