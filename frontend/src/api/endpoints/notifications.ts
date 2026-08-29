import { api } from '../client'

export interface AppNotification {
  id: number
  type: string
  title: string
  message: string
  read_at: string | null
  created_at: string
}

export const notificationsApi = {
  list: (unreadOnly = false) => api.get<AppNotification[]>('/notifications', { params: { unread_only: unreadOnly } }).then((r) => r.data),
  markRead: (id: number) => api.post(`/notifications/${id}/read`).then((r) => r.data),
  markAllRead: () => api.post('/notifications/read-all').then((r) => r.data),
}
