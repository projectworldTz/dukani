import { api } from '../client'

export const businessApi = {
  settings: () => api.get('/business/settings').then((r) => r.data),
  updateSettings: (data: Record<string, unknown>) => api.put('/business/settings', data).then((r) => r.data),
}
