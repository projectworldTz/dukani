import { api } from '../client'

export interface AuditLogEntry {
  id: number
  action: string
  auditable_type: string | null
  auditable_id: number | null
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  user: { id: number; name: string } | null
  created_at: string
}

interface PaginatedAuditLogs {
  data: AuditLogEntry[]
  current_page: number
  last_page: number
}

export const auditApi = {
  list: (page = 1) => api.get<PaginatedAuditLogs>('/audit-logs', { params: { page } }).then((r) => r.data),
}
