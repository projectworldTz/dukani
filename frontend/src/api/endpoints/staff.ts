import { api } from '../client'
import type { StaffMember } from '../../types'

export interface StaffPayload {
  name: string
  email: string
  phone?: string
  branch_id?: number | null
  job_title?: string
  password?: string
  status?: 'active' | 'inactive'
  roles: string[]
}

interface Paginated<T> {
  data: T[]
  meta?: { current_page: number; last_page: number; total: number }
}

export const staffApi = {
  list: () => api.get<Paginated<StaffMember>>('/staff').then((r) => r.data.data),
  create: (data: StaffPayload) =>
    api.post<{ data: StaffMember; generated_password: string | null }>('/staff', data).then((r) => r.data),
  update: (id: number, data: Partial<StaffPayload>) =>
    api.put<StaffMember>(`/staff/${id}`, data).then((r) => r.data),
}
