import { BackspaceOutlined, ContentCopyRounded } from '@mui/icons-material'
import { Box, ButtonBase, IconButton, Tooltip, Typography } from '@mui/material'
import { useCallback, useEffect, useState } from 'react'
import { useToastStore } from '../../stores/toastStore'
import { useCalculatorStore } from './calculatorStore'
import { CalcError, evaluate, formatNumber, preview } from './expression'

type KeyKind = 'digit' | 'func' | 'op' | 'equals' | 'clear'

interface Key {
  label: string
  /** What to insert, or a command name. */
  input: string
  kind: KeyKind
  aria?: string
}

// 5 × 5 keypad: functions on the left, digits in the middle, operators on the right.
const KEYS: Key[] = [
  { label: 'AC', input: 'clear', kind: 'clear', aria: 'Clear all' },
  { label: '(', input: '(', kind: 'func' },
  { label: ')', input: ')', kind: 'func' },
  { label: '%', input: '%', kind: 'func', aria: 'Percent' },
  { label: '÷', input: '÷', kind: 'op', aria: 'Divide' },
  { label: '√', input: '√', kind: 'func', aria: 'Square root' },
  { label: '7', input: '7', kind: 'digit' },
  { label: '8', input: '8', kind: 'digit' },
  { label: '9', input: '9', kind: 'digit' },
  { label: '×', input: '×', kind: 'op', aria: 'Multiply' },
  { label: 'x²', input: '²', kind: 'func', aria: 'Square' },
  { label: '4', input: '4', kind: 'digit' },
  { label: '5', input: '5', kind: 'digit' },
  { label: '6', input: '6', kind: 'digit' },
  { label: '−', input: '-', kind: 'op', aria: 'Minus' },
  { label: 'xʸ', input: '^', kind: 'func', aria: 'Power' },
  { label: '1', input: '1', kind: 'digit' },
  { label: '2', input: '2', kind: 'digit' },
  { label: '3', input: '3', kind: 'digit' },
  { label: '+', input: '+', kind: 'op', aria: 'Plus' },
  { label: '±', input: 'negate', kind: 'func', aria: 'Positive or negative' },
  { label: '0', input: '0', kind: 'digit' },
  { label: '.', input: '.', kind: 'digit', aria: 'Decimal point' },
  { label: '⌫', input: 'back', kind: 'func', aria: 'Delete last' },
  { label: '=', input: 'equals', kind: 'equals', aria: 'Equals' },
]

const KEY_STYLES: Record<KeyKind, object> = {
  digit: { bgcolor: '#FFFFFF', color: '#0F172A', border: '1px solid #E2E8F0', fontSize: 24, fontWeight: 600 },
  func: { bgcolor: '#F0FDF4', color: '#166534', fontSize: 19, fontWeight: 600 },
  op: { bgcolor: '#DCFCE7', color: '#15803D', fontSize: 26, fontWeight: 600 },
  equals: { bgcolor: '#16A34A', color: '#FFFFFF', fontSize: 28, fontWeight: 700, boxShadow: '0 6px 16px rgba(22,163,74,0.4)' },
  clear: { bgcolor: '#FEF2F2', color: '#DC2626', fontSize: 18, fontWeight: 700 },
}

/** "12×5+3" → "12 × 5 + 3" for the display. */
const pretty = (e: string) => e.replace(/([+×÷^]|(?<=[\d)%²])-)/g, ' $1 ').replace(/\s+/g, ' ').trim()

/** Toggle the sign of the last number typed: "12×5" → "12×(-5)" → "12×5". */
function negateLast(expr: string): string {
  const wrapped = expr.match(/^(.*)\(-(\d*\.?\d+)\)$/)
  if (wrapped) return wrapped[1] + wrapped[2]
  const last = expr.match(/^(.*?)(\d*\.?\d+)$/)
  if (last) return `${last[1]}(-${last[2]})`
  return expr === '' ? '-' : expr
}

export function StandardCalculator({ active }: { active: boolean }) {
  const addHistory = useCalculatorStore((s) => s.addHistory)
  const takePendingExpression = useCalculatorStore((s) => s.takePendingExpression)
  const pendingExpression = useCalculatorStore((s) => s.pendingExpression)
  const [expr, setExpr] = useState('')
  const [result, setResult] = useState<number | null>(null)
  const [lastExpr, setLastExpr] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pressed, setPressed] = useState<string | null>(null)

  // A result sent over from "Recent".
  useEffect(() => {
    if (pendingExpression === null) return
    const e = takePendingExpression()
    if (e !== null) {
      setExpr(e)
      setResult(null)
      setError(null)
    }
  }, [pendingExpression, takePendingExpression])

  const press = useCallback(
    (input: string) => {
      setError(null)
      const justEvaluated = result !== null
      if (input === 'clear') {
        setExpr('')
        setResult(null)
        setLastExpr('')
        return
      }
      if (input === 'back') {
        if (justEvaluated) {
          setResult(null)
          setExpr('')
        } else setExpr((e) => e.slice(0, -1))
        return
      }
      if (input === 'negate') {
        if (justEvaluated) {
          setExpr(String(-result))
          setResult(null)
        } else setExpr((e) => negateLast(e))
        return
      }
      if (input === 'equals') {
        if (!expr) return
        try {
          const value = evaluate(expr)
          setResult(value)
          setLastExpr(expr)
          setExpr(String(value))
          addHistory({ title: 'Standard', detail: pretty(expr), result: formatNumber(value), value })
        } catch (e) {
          setError(e instanceof CalcError ? e.message : 'That calculation is not valid.')
        }
        return
      }
      // Typing a digit after "=" starts fresh; an operator continues from the answer.
      const startsFresh = justEvaluated && /[\d.(√]/.test(input)
      setResult(null)
      setLastExpr('')
      setExpr((e) => (startsFresh ? input : e + input).slice(0, 120))
    },
    [expr, result, addHistory],
  )

  // Desktop keyboard support while this tab is showing (ignored when typing in a field).
  useEffect(() => {
    if (!active) return
    const map: Record<string, string> = {
      Enter: 'equals', '=': 'equals', Backspace: 'back', Delete: 'clear',
      '*': '×', x: '×', X: '×', '/': '÷', '+': '+', '-': '-', '^': '^', '%': '%', '(': '(', ')': ')', '.': '.', ',': '.', r: '√', R: '√',
    }
    function onKey(e: KeyboardEvent) {
      const t = e.target
      if (e.ctrlKey || e.metaKey || e.altKey || (t instanceof Element && t.matches('input, textarea, [contenteditable="true"]'))) return
      const input = /^[0-9]$/.test(e.key) ? e.key : map[e.key]
      if (!input) return
      e.preventDefault()
      e.stopPropagation()
      press(input)
      const key = KEYS.find((k) => k.input === input)
      if (key) {
        setPressed(key.label)
        setTimeout(() => setPressed(null), 120)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [active, press])

  const live = result === null ? preview(expr) : result
  const shown = result !== null ? formatNumber(result) : live !== null ? formatNumber(live) : '0'
  const shownSize = shown.length > 16 ? 26 : shown.length > 12 ? 32 : 42

  async function copy() {
    const value = result ?? live
    if (value === null) return
    await navigator.clipboard?.writeText(String(value)).catch(() => undefined)
    useToastStore.getState().show(`Copied ${formatNumber(value)}`, 'success')
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Display */}
      <Box
        sx={{
          position: 'relative',
          borderRadius: '18px',
          px: 2.5,
          pt: 2,
          pb: 2.25,
          minHeight: 132,
          background: 'linear-gradient(160deg, #15803D 0%, #166534 45%, #052E16 100%)',
          color: '#fff',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 10px 24px rgba(15,23,42,0.18)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          alignItems: 'flex-end',
          overflow: 'hidden',
        }}
        aria-live="polite"
      >
        <Tooltip title="Copy answer">
          <span style={{ position: 'absolute', top: 10, left: 10 }}>
            <IconButton size="small" onClick={copy} disabled={(result ?? live) === null} sx={{ color: 'rgba(255,255,255,0.7)', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.1)' } }} aria-label="Copy answer">
              <ContentCopyRounded fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Typography sx={{ fontSize: 16, color: 'rgba(220,252,231,0.75)', minHeight: 24, maxWidth: '85%', textAlign: 'right', wordBreak: 'break-all', fontVariantNumeric: 'tabular-nums' }}>
          {result !== null ? `${pretty(lastExpr)} =` : pretty(expr) || ' '}
        </Typography>
        <Typography
          data-testid="calc-display"
          sx={{ fontSize: shownSize, fontWeight: 700, lineHeight: 1.15, letterSpacing: -0.5, fontVariantNumeric: 'tabular-nums', color: result === null && expr ? 'rgba(255,255,255,0.78)' : '#fff', wordBreak: 'break-all', textAlign: 'right' }}
        >
          {shown}
        </Typography>
        {error && (
          <Typography role="alert" sx={{ mt: 0.75, fontSize: 13.5, fontWeight: 600, color: '#FCA5A5' }}>
            {error}
          </Typography>
        )}
      </Box>

      {/* Keypad */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: { xs: 1, sm: 1.25 } }}>
        {KEYS.map((k) => (
          <ButtonBase
            key={k.label}
            onClick={() => press(k.input)}
            aria-label={k.aria ?? k.label}
            sx={{
              height: { xs: 56, sm: 58 },
              borderRadius: '14px',
              fontFamily: 'inherit',
              transition: 'transform .08s ease, filter .12s ease, box-shadow .12s',
              transform: pressed === k.label ? 'scale(0.94)' : 'none',
              '&:hover': { filter: 'brightness(0.97)' },
              '&:active': { transform: 'scale(0.94)' },
              ...KEY_STYLES[k.kind],
            }}
          >
            {k.input === 'back' ? <BackspaceOutlined sx={{ fontSize: 22 }} /> : k.label}
          </ButtonBase>
        ))}
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', display: { xs: 'none', sm: 'block' } }}>
        Type with your keyboard too: numbers, + − * / ^ % ( ), Enter for =, Backspace, Delete to clear.
      </Typography>
    </Box>
  )
}
