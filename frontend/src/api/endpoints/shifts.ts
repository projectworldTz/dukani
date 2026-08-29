import { api } from '../client'
import type { CashierShift } from '../../types'

export const shiftsApi = {
  current: () => api.get<CashierShift | null>('/shifts/current').then((r) => r.data),
  open: (branchId: number, openingCash: number) =>
    api.post<CashierShift>('/shifts/open', { branch_id: branchId, opening_cash: openingCash }).then((r) => r.data),
  close: (shiftId: number, closingCash: number, notes?: string) =>
    api.post<CashierShift>(`/shifts/${shiftId}/close`, { closing_cash: closingCash, notes }).then((r) => r.data),
}
