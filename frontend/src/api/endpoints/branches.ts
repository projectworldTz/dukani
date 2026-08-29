import { api } from '../client'
import type { Branch } from '../../types'

export const branchesApi = {
  list: () => api.get<Branch[]>('/branches').then((r) => r.data),
  create: (data: Partial<Branch>) => api.post<Branch>('/branches', data).then((r) => r.data),
  update: (id: number, data: Partial<Branch>) => api.put<Branch>(`/branches/${id}`, data).then((r) => r.data),
}
