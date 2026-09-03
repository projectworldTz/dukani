import { describe, expect, it, beforeEach } from 'vitest'
import { useAuthStore } from './authStore'
import type { AuthUser } from '../types'

const baseUser: AuthUser = {
  id: 1,
  name: 'Nia Mwangi',
  email: 'nia@example.com',
  email_verified_at: null,
  phone: null,
  status: 'active',
  is_platform_admin: false,
  branch_id: null,
  job_title: 'Business Owner',
  roles: ['Business Owner'],
  permissions: ['sales.create', 'products.manage'],
  business: null,
}

describe('authStore', () => {
  beforeEach(() => {
    sessionStorage.clear()
    useAuthStore.getState().clear()
  })

  it('starts signed out', () => {
    expect(useAuthStore.getState().token).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('setAuth stores the token and user together', () => {
    useAuthStore.getState().setAuth('token-123', baseUser)

    expect(useAuthStore.getState().token).toBe('token-123')
    expect(useAuthStore.getState().user?.email).toBe('nia@example.com')
    expect(localStorage.getItem('dukani-auth')).toBeNull()
    expect(sessionStorage.getItem('dukani-auth')).toContain('token-123')
  })

  it('clear wipes both token and user', () => {
    useAuthStore.getState().setAuth('token-123', baseUser)
    useAuthStore.getState().clear()

    expect(useAuthStore.getState().token).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('hasPermission reflects the current user only', () => {
    expect(useAuthStore.getState().hasPermission('sales.create')).toBe(false)

    useAuthStore.getState().setAuth('token-123', baseUser)

    expect(useAuthStore.getState().hasPermission('sales.create')).toBe(true)
    expect(useAuthStore.getState().hasPermission('staff.manage')).toBe(false)
  })

  it('hasRole reflects the current user only', () => {
    useAuthStore.getState().setAuth('token-123', baseUser)

    expect(useAuthStore.getState().hasRole('Business Owner')).toBe(true)
    expect(useAuthStore.getState().hasRole('Cashier')).toBe(false)
  })
})
