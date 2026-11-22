/**
 * Safe arithmetic evaluator for the calculator — a small recursive-descent parser.
 * Never uses eval()/Function(): input is tokenised into numbers, operators and
 * brackets only, so arbitrary code can't run.
 *
 * Grammar (lowest → highest precedence):
 *   expr    := term (('+' | '-') term)*
 *   term    := unary (('×' | '÷') unary | implicit-× unary)*
 *   unary   := ('-' | '+' | '√') unary | power
 *   power   := postfix ('^' unary)?            (right-associative; -2^2 = -4)
 *   postfix := primary '%'*
 *   primary := number | '(' expr ')'
 *
 * Percent behaves like a shop calculator: "200 + 10%" = 220, "200 - 10%" = 180,
 * "200 × 10%" = 20 and "50%" = 0.5.
 */

export class CalcError extends Error {}

type Token =
  | { type: 'num'; value: number }
  | { type: 'op'; value: '+' | '-' | '×' | '÷' | '^' | '%' | '√' }
  | { type: 'paren'; value: '(' | ')' }

const OP_ALIASES: Record<string, Token['value']> = {
  '+': '+',
  '-': '-',
  '−': '-',
  '*': '×',
  'x': '×',
  '×': '×',
  '/': '÷',
  '÷': '÷',
  '^': '^',
  '%': '%',
  '√': '√',
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  const s = input.replace(/,/g, '')
  while (i < s.length) {
    const ch = s[i]
    if (ch === ' ') {
      i++
      continue
    }
    if (/[0-9.]/.test(ch)) {
      let j = i
      while (j < s.length && /[0-9.]/.test(s[j])) j++
      const raw = s.slice(i, j)
      if ((raw.match(/\./g) ?? []).length > 1 || raw === '.') throw new CalcError('That number has too many decimal points.')
      tokens.push({ type: 'num', value: Number(raw) })
      i = j
      continue
    }
    if (ch === '(' || ch === ')') {
      tokens.push({ type: 'paren', value: ch })
      i++
      continue
    }
    if (ch === '²') {
      tokens.push({ type: 'op', value: '^' }, { type: 'num', value: 2 })
      i++
      continue
    }
    const op = OP_ALIASES[ch]
    if (op) {
      tokens.push({ type: 'op', value: op } as Token)
      i++
      continue
    }
    throw new CalcError(`“${ch}” can't be used in a calculation.`)
  }
  return tokens
}

interface Value {
  value: number
  /** True when this operand is a bare "n%" — lets "a + n%" mean "a plus n% of a". */
  percent: boolean
}

class Parser {
  private pos = 0
  private readonly tokens: Token[]

  constructor(tokens: Token[]) {
    this.tokens = tokens
  }

  parse(): number {
    if (this.tokens.length === 0) throw new CalcError('Enter a calculation.')
    const result = this.expr().value
    if (this.pos < this.tokens.length) {
      const t = this.tokens[this.pos]
      throw new CalcError(t.type === 'paren' && t.value === ')' ? 'There is a closing bracket without an opening one.' : 'The calculation is not complete.')
    }
    return result
  }

  private peek() {
    return this.tokens[this.pos]
  }

  private isOp(v: string) {
    const t = this.peek()
    return t?.type === 'op' && t.value === v
  }

  private expr(): Value {
    let left = this.term()
    while (this.isOp('+') || this.isOp('-')) {
      const op = (this.tokens[this.pos++] as { value: string }).value
      const right = this.term()
      const amount = right.percent ? (left.value * right.value) : right.value
      left = { value: op === '+' ? left.value + amount : left.value - amount, percent: false }
    }
    return left
  }

  private startsOperand() {
    const t = this.peek()
    return t && (t.type === 'num' || (t.type === 'paren' && t.value === '(') || (t.type === 'op' && t.value === '√'))
  }

  private term(): Value {
    let left = this.unary()
    for (;;) {
      if (this.isOp('×') || this.isOp('÷')) {
        const op = (this.tokens[this.pos++] as { value: string }).value
        const right = this.unary()
        if (op === '÷') {
          if (right.value === 0) throw new CalcError("Can't divide by zero.")
          left = { value: left.value / right.value, percent: false }
        } else {
          left = { value: left.value * right.value, percent: false }
        }
      } else if (this.startsOperand()) {
        // Implicit multiplication: "2(3+4)" or "(2)(3)" or "2√9".
        const right = this.unary()
        left = { value: left.value * right.value, percent: false }
      } else {
        return left
      }
    }
  }

  private unary(): Value {
    if (this.isOp('-')) {
      this.pos++
      const v = this.unary()
      return { value: -v.value, percent: v.percent }
    }
    if (this.isOp('+')) {
      this.pos++
      return this.unary()
    }
    if (this.isOp('√')) {
      this.pos++
      const v = this.unary()
      if (v.value < 0) throw new CalcError("Can't take the square root of a negative number.")
      return { value: Math.sqrt(v.value), percent: false }
    }
    return this.power()
  }

  private power(): Value {
    const base = this.postfix()
    if (this.isOp('^')) {
      this.pos++
      const exponent = this.unary()
      const value = Math.pow(base.value, exponent.value)
      if (Number.isNaN(value)) throw new CalcError('That power has no real answer.')
      return { value, percent: false }
    }
    return base
  }

  private postfix(): Value {
    let v = this.primary()
    while (this.isOp('%')) {
      this.pos++
      v = { value: v.value / 100, percent: true }
    }
    return v
  }

  private primary(): Value {
    const t = this.peek()
    if (!t) throw new CalcError('The calculation is not complete.')
    if (t.type === 'num') {
      this.pos++
      return { value: t.value, percent: false }
    }
    if (t.type === 'paren' && t.value === '(') {
      this.pos++
      const inner = this.expr()
      if (!(this.peek()?.type === 'paren' && this.peek()?.value === ')')) throw new CalcError('A bracket is not closed.')
      this.pos++
      return { value: inner.value, percent: false }
    }
    throw new CalcError('The calculation is not complete.')
  }
}

/** Trims binary floating-point noise (0.1 + 0.2 → 0.3) without losing real precision. */
export function tidy(n: number): number {
  // Whole numbers are exact already — rounding them would corrupt large results.
  if (!Number.isFinite(n) || Number.isInteger(n)) return n
  // 15 significant digits is the precision a double can represent reliably.
  return Number.parseFloat(n.toPrecision(15))
}

export function evaluate(input: string): number {
  const value = new Parser(tokenize(input)).parse()
  if (!Number.isFinite(value)) throw new CalcError('The answer is too large to show.')
  return tidy(value) === 0 ? 0 : tidy(value)
}

/**
 * Best-effort live preview while typing: ignores a dangling operator and auto-closes
 * open brackets. Returns null instead of throwing.
 */
export function preview(input: string): number | null {
  let s = input.trim().replace(/[+\-−×÷*/^√(]+$/, '')
  if (!s) return null
  const open = (s.match(/\(/g) ?? []).length - (s.match(/\)/g) ?? []).length
  if (open > 0) s += ')'.repeat(open)
  try {
    return evaluate(s)
  } catch {
    return null
  }
}

/** Display formatting: thousands separators, up to 10 decimals, scientific for huge values. */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (Math.abs(n) >= 1e15 || (Math.abs(n) < 1e-9 && n !== 0)) return n.toExponential(6).replace(/\.?0+e/, 'e')
  return n.toLocaleString('en-US', { maximumFractionDigits: 10 })
}
