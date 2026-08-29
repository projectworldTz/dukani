import { api } from '../client'
import type { RoleWithPermissions } from '../../types'

export type PermissionCatalog = Record<string, Record<string, string>>

export const rbacApi = {
  catalog: () => api.get<PermissionCatalog>('/roles/permission-catalog').then((r) => r.data),
  roles: () => api.get<RoleWithPermissions[]>('/roles').then((r) => r.data),
  createRole: (name: string, permissions: string[]) =>
    api.post('/roles', { name, permissions }).then((r) => r.data),
  updatePermissions: (roleId: number, permissions: string[]) =>
    api.put(`/roles/${roleId}/permissions`, { permissions }).then((r) => r.data),
  setLimit: (roleId: number, key: string, value: number) =>
    api.post(`/roles/${roleId}/limits`, { key, value }).then((r) => r.data),
}
