import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PaymentDialog } from './PaymentDialog'

const methods = [
  { id: 1, name: 'Cash', type: 'cash', is_active: true },
  { id: 2, name: 'Mobile Money', type: 'mobile_money', is_active: true },
]

describe('PaymentDialog', () => {
  it('starts each mounted checkout with the current total and completes exact cash', () => {
    const onConfirm = vi.fn()
    render(
      <PaymentDialog
        open
        grandTotal={12500}
        currency="TZS"
        paymentMethods={methods}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    )

    expect(screen.getByText(/12,500\.00/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Complete sale' }))
    expect(onConfirm).toHaveBeenCalledWith([{ payment_method_id: 1, amount: 12500 }])
  })

  it('permits an explicit short payment only for an eligible credit customer', () => {
    const onConfirm = vi.fn()
    render(
      <PaymentDialog
        open
        grandTotal={10000}
        currency="TZS"
        paymentMethods={methods}
        creditAllowed
        customerName="Asha"
        availableCredit={5000}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    )

    fireEvent.change(screen.getByLabelText('Cash received'), { target: { value: '7000' } })
    expect(screen.getByText(/recorded on Asha's account/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Complete sale' }))
    expect(onConfirm).toHaveBeenCalledWith([{ payment_method_id: 1, amount: 7000 }])
  })
})
