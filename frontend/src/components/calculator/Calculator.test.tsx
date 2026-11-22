import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { BusinessTools } from './BusinessTools'
import { useCalculatorStore } from './calculatorStore'
import { StandardCalculator } from './StandardCalculator'

function wrap(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

const tap = (name: string) => fireEvent.click(screen.getByRole('button', { name }))

beforeEach(() => useCalculatorStore.setState({ history: [], pendingExpression: null }))

describe('StandardCalculator', () => {
  it('adds with the keypad and records the answer in Recent', () => {
    wrap(<StandardCalculator active />)
    tap('1'); tap('2'); tap('Plus'); tap('3'); tap('Equals')
    expect(screen.getByTestId('calc-display')).toHaveTextContent('15')
    expect(useCalculatorStore.getState().history[0]).toMatchObject({ title: 'Standard', detail: '12 + 3', result: '15' })
  })

  it('respects order of operations and percent', () => {
    wrap(<StandardCalculator active />)
    tap('2'); tap('0'); tap('0'); tap('Plus'); tap('1'); tap('0'); tap('Percent'); tap('Equals')
    expect(screen.getByTestId('calc-display')).toHaveTextContent('220')
  })

  it('accepts keyboard input', () => {
    wrap(<StandardCalculator active />)
    for (const key of ['7', '*', '6', 'Enter']) fireEvent.keyDown(window, { key })
    expect(screen.getByTestId('calc-display')).toHaveTextContent('42')
    fireEvent.keyDown(window, { key: 'Delete' })
    expect(screen.getByTestId('calc-display')).toHaveTextContent('0')
  })

  it('shows a friendly message for divide by zero', () => {
    wrap(<StandardCalculator active />)
    tap('5'); tap('Divide'); tap('0'); tap('Equals')
    expect(screen.getByRole('alert')).toHaveTextContent("Can't divide by zero.")
  })

  it('toggles the sign of the last number and backspaces', () => {
    wrap(<StandardCalculator active />)
    tap('9'); tap('Positive or negative'); tap('Plus'); tap('4'); tap('Equals')
    expect(screen.getByTestId('calc-display')).toHaveTextContent('-5')
    tap('Clear all'); tap('1'); tap('2'); tap('Delete last')
    expect(screen.getByTestId('calc-display')).toHaveTextContent('1')
  })
})

describe('BusinessTools', () => {
  it('opens the profit tool and calculates instantly', () => {
    wrap(<BusinessTools />)
    fireEvent.click(screen.getByText('Profit'))
    fireEvent.change(screen.getByLabelText('Buying price (each)'), { target: { value: '700' } })
    fireEvent.change(screen.getByLabelText('Selling price (each)'), { target: { value: '1000' } })
    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '24' } })
    expect(screen.getByTestId('tool-primary')).toHaveTextContent('7,200')
    expect(screen.getByText('30%')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Save to Recent' }))
    expect(useCalculatorStore.getState().history[0].title).toBe('Profit')
  })

  it('shows validation only for typed values', () => {
    wrap(<BusinessTools />)
    fireEvent.click(screen.getByText('Change'))
    expect(screen.queryByText(/Enter the/)).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Amount to pay'), { target: { value: '5900' } })
    fireEvent.change(screen.getByLabelText('Customer gave'), { target: { value: '10000' } })
    expect(screen.getByTestId('tool-primary')).toHaveTextContent('4,100')
    expect(screen.getByText('2 × 2,000')).toBeInTheDocument()
  })
})
