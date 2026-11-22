import {
  AccountBalanceRounded,
  ArrowBackRounded,
  BalanceRounded,
  ContentCopyRounded,
  CurrencyExchangeRounded,
  Inventory2Rounded,
  LocalOfferRounded,
  PercentRounded,
  ReceiptLongRounded,
  TrendingUpRounded,
} from '@mui/icons-material'
import { Alert, Box, Button, ButtonBase, Chip, IconButton, InputAdornment, Stack, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState, type ReactNode } from 'react'
import { businessApi } from '../../api/endpoints/business'
import { useAuthStore } from '../../stores/authStore'
import { useToastStore } from '../../stores/toastStore'
import {
  breakEvenCalc,
  breakdown,
  changeCalc,
  discountCalc,
  markupCalc,
  profitCalc,
  salesCalc,
  stockValueCalc,
  vatCalc,
  type Fields,
  type ResultLine,
  type ToolResult,
} from './business'
import { useCalculatorStore } from './calculatorStore'

type Unit = 'money' | 'percent' | 'qty'

interface FieldDef {
  key: string
  label: string
  unit: Unit
  placeholder?: string
  optional?: boolean
  help?: string
}

interface ToolDef {
  id: string
  name: string
  description: string
  icon: ReactNode
  color: string
  category: string
  fields: FieldDef[]
  calc: (f: Fields) => ToolResult
  defaults?: Fields
}

const TOOLS: ToolDef[] = [
  {
    id: 'profit', name: 'Profit', description: 'How much you make on a sale', icon: <TrendingUpRounded />, color: '#16A34A', category: 'Pricing & Profit',
    fields: [
      { key: 'buy', label: 'Buying price (each)', unit: 'money', placeholder: '700' },
      { key: 'sell', label: 'Selling price (each)', unit: 'money', placeholder: '1,000' },
      { key: 'qty', label: 'Quantity', unit: 'qty', placeholder: '1', optional: true },
    ],
    calc: profitCalc,
  },
  {
    id: 'markup', name: 'Markup', description: 'What price to sell at', icon: <LocalOfferRounded />, color: '#2563EB', category: 'Pricing & Profit',
    fields: [
      { key: 'cost', label: 'Cost price', unit: 'money', placeholder: '700' },
      { key: 'pct', label: 'Markup you want', unit: 'percent', placeholder: '30' },
    ],
    calc: markupCalc,
  },
  {
    id: 'discount', name: 'Discount', description: 'Price after a discount', icon: <PercentRounded />, color: '#F59E0B', category: 'Pricing & Profit',
    fields: [
      { key: 'price', label: 'Original price', unit: 'money', placeholder: '15,000' },
      { key: 'pct', label: 'Discount', unit: 'percent', placeholder: '10' },
    ],
    calc: discountCalc,
  },
  {
    id: 'vat', name: 'VAT', description: 'Add or remove VAT', icon: <AccountBalanceRounded />, color: '#7C3AED', category: 'Tax',
    fields: [
      { key: 'amount', label: 'Amount', unit: 'money', placeholder: '10,000' },
      { key: 'rate', label: 'VAT rate', unit: 'percent', placeholder: '18' },
    ],
    calc: vatCalc,
    defaults: { mode: 'add' },
  },
  {
    id: 'sales', name: 'Sale total', description: 'Price × quantity, less discount', icon: <ReceiptLongRounded />, color: '#0EA5E9', category: 'At the till',
    fields: [
      { key: 'price', label: 'Price (each)', unit: 'money', placeholder: '1,500' },
      { key: 'qty', label: 'Quantity', unit: 'qty', placeholder: '4' },
      { key: 'discount', label: 'Discount', unit: 'percent', placeholder: '0', optional: true },
    ],
    calc: salesCalc,
    defaults: { discountType: 'percent' },
  },
  {
    id: 'change', name: 'Change', description: 'Change to give back', icon: <CurrencyExchangeRounded />, color: '#14B8A6', category: 'At the till',
    fields: [
      { key: 'due', label: 'Amount to pay', unit: 'money', placeholder: '5,900' },
      { key: 'received', label: 'Customer gave', unit: 'money', placeholder: '10,000' },
    ],
    calc: changeCalc,
  },
  {
    id: 'stock', name: 'Stock value', description: 'What your stock is worth', icon: <Inventory2Rounded />, color: '#EA580C', category: 'Planning',
    fields: [
      { key: 'qty', label: 'Quantity in stock', unit: 'qty', placeholder: '48' },
      { key: 'unit', label: 'Buying price (each)', unit: 'money', placeholder: '700' },
      { key: 'sell', label: 'Selling price (each)', unit: 'money', placeholder: '1,000', optional: true, help: 'Optional — shows what you could earn' },
    ],
    calc: stockValueCalc,
  },
  {
    id: 'breakeven', name: 'Break-even', description: 'Sales needed to cover costs', icon: <BalanceRounded />, color: '#DB2777', category: 'Planning',
    fields: [
      { key: 'fixed', label: 'Fixed costs (rent, salaries…)', unit: 'money', placeholder: '300,000' },
      { key: 'price', label: 'Selling price per item', unit: 'money', placeholder: '1,500' },
      { key: 'variable', label: 'Cost per item', unit: 'money', placeholder: '1,000' },
    ],
    calc: breakEvenCalc,
  },
]

const CATEGORIES = ['Pricing & Profit', 'Tax', 'At the till', 'Planning']

function useMoney() {
  const currency = useAuthStore((s) => s.user?.business?.currency) || 'TZS'
  return {
    currency,
    format: (line: Pick<ResultLine, 'value' | 'kind'>) =>
      line.kind === 'money'
        ? `${currency} ${line.value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
        : line.kind === 'percent'
          ? `${line.value.toLocaleString('en-US', { maximumFractionDigits: 2 })}%`
          : line.value.toLocaleString('en-US', { maximumFractionDigits: 2 }),
  }
}

async function copyText(text: string) {
  await navigator.clipboard?.writeText(text).catch(() => undefined)
  useToastStore.getState().show(`Copied ${text}`, 'success')
}

function ToolView({ tool, onBack }: { tool: ToolDef; onBack: () => void }) {
  const { currency, format } = useMoney()
  const addHistory = useCalculatorStore((s) => s.addHistory)
  const settingsQuery = useQuery({ queryKey: ['business-settings'], queryFn: businessApi.settings, staleTime: 10 * 60_000 })
  // VAT defaults to the business's own tax rate (Settings), falling back to Tanzania's 18%.
  const businessRate = Number(settingsQuery.data?.settings?.default_tax_rate ?? 0) || 18
  const [fields, setFields] = useState<Fields>(() => ({ ...(tool.defaults ?? {}), ...(tool.id === 'vat' ? { rate: String(businessRate) } : {}) }))
  const result = useMemo(() => tool.calc(fields), [tool, fields])
  const set = (key: string, value: string) => setFields((f) => ({ ...f, [key]: value }))
  const primary = result.lines.find((l) => l.primary)
  const hasResult = result.lines.length > 0
  // Show a field's error only once something has been typed in it — empty fields just wait.
  const errorFor = (key: string) => ((fields[key] ?? '') !== '' || (tool.id === 'breakeven' && key === 'price') || (tool.id === 'sales' && key === 'discount') ? result.errors[key] : undefined)

  function save() {
    if (!primary) return
    const detail = tool.fields
      .filter((f) => (fields[f.key] ?? '') !== '')
      .map((f) => `${f.label.replace(/ \(.*\)/, '')} ${fields[f.key]}${f.unit === 'percent' ? '%' : ''}`)
      .join(' · ')
    addHistory({ title: tool.name, detail, result: `${primary.label}: ${format(primary)}`, value: primary.value })
    useToastStore.getState().show('Saved to Recent.', 'success')
  }

  const vatRates = [...new Set([businessRate, 18, 16, 0])]

  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
        <IconButton onClick={onBack} aria-label="Back to all tools" sx={{ bgcolor: '#F1F5F9' }}>
          <ArrowBackRounded />
        </IconButton>
        <Box sx={{ width: 40, height: 40, borderRadius: '12px', bgcolor: tool.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{tool.icon}</Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 18, lineHeight: 1.2 }}>{tool.name}</Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {tool.description}
          </Typography>
        </Box>
      </Stack>

      {tool.id === 'vat' && (
        <ToggleButtonGroup exclusive fullWidth size="small" value={fields.mode} onChange={(_, v) => v && set('mode', v)} sx={{ mb: 2, '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 600 } }}>
          <ToggleButton value="add">Add VAT to a price</ToggleButton>
          <ToggleButton value="extract">Price already includes VAT</ToggleButton>
        </ToggleButtonGroup>
      )}

      <Stack spacing={2}>
        {tool.fields.map((f) => {
          const isDiscount = tool.id === 'sales' && f.key === 'discount'
          const asPercent = f.unit === 'percent' && !(isDiscount && fields.discountType === 'amount')
          return (
            <Box key={f.key}>
              <TextField
                label={f.label + (f.optional ? ' (optional)' : '')}
                placeholder={f.placeholder}
                value={fields[f.key] ?? ''}
                onChange={(e) => set(f.key, e.target.value.replace(/[^0-9.,-]/g, ''))}
                error={!!errorFor(f.key)}
                helperText={errorFor(f.key) ?? f.help}
                fullWidth
                slotProps={{
                  htmlInput: { inputMode: 'decimal', 'aria-label': f.label },
                  input: {
                    startAdornment: !asPercent && f.unit === 'money' ? <InputAdornment position="start">{currency}</InputAdornment> : isDiscount && !asPercent ? <InputAdornment position="start">{currency}</InputAdornment> : undefined,
                    endAdornment: asPercent ? <InputAdornment position="end">%</InputAdornment> : undefined,
                    sx: { fontSize: 18, fontWeight: 600 },
                  },
                }}
              />
              {tool.id === 'vat' && f.key === 'rate' && (
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  {vatRates.map((r) => (
                    <Chip key={r} label={`${r}%`} onClick={() => set('rate', String(r))} color={Number(fields.rate) === r ? 'primary' : 'default'} variant={Number(fields.rate) === r ? 'filled' : 'outlined'} sx={{ fontWeight: 600 }} />
                  ))}
                </Stack>
              )}
              {isDiscount && (
                <ToggleButtonGroup exclusive size="small" value={fields.discountType} onChange={(_, v) => v && set('discountType', v)} sx={{ mt: 1, '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 600, px: 2 } }}>
                  <ToggleButton value="percent">As %</ToggleButton>
                  <ToggleButton value="amount">As amount</ToggleButton>
                </ToggleButtonGroup>
              )}
            </Box>
          )
        })}
      </Stack>

      <Box sx={{ mt: 2.5, borderRadius: '16px', border: '1px solid', borderColor: hasResult ? '#BBF7D0' : 'divider', bgcolor: hasResult ? '#F7FEF9' : '#F8FAFC', overflow: 'hidden' }}>
        {primary ? (
          <Box sx={{ px: 2.5, py: 2, background: 'linear-gradient(135deg, #16A34A 0%, #15803D 100%)', color: '#fff' }}>
            <Stack direction="row" sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <Typography sx={{ fontSize: 14, opacity: 0.85, fontWeight: 500 }}>{primary.label}</Typography>
              <Tooltip title="Copy">
                <IconButton size="small" onClick={() => copyText(format(primary))} sx={{ color: '#fff', mt: -0.5, mr: -1 }} aria-label={`Copy ${primary.label}`}>
                  <ContentCopyRounded fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
            <Typography data-testid="tool-primary" sx={{ fontSize: 32, fontWeight: 800, lineHeight: 1.15, letterSpacing: -0.5, wordBreak: 'break-word' }}>
              {format(primary)}
            </Typography>
          </Box>
        ) : (
          <Typography color="text.secondary" sx={{ p: 2.5, textAlign: 'center' }}>
            Fill in the boxes above — your answer appears here instantly.
          </Typography>
        )}
        {result.lines
          .filter((l) => !l.primary)
          .map((l) => (
            <Stack key={l.label} direction="row" sx={{ alignItems: 'center', px: 2.5, py: 1.25, borderTop: '1px solid', borderColor: 'divider', gap: 1 }}>
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 14.5, color: 'text.secondary' }}>{l.label}</Typography>
                {l.hint && (
                  <Typography variant="caption" color="text.disabled">
                    {l.hint}
                  </Typography>
                )}
              </Box>
              <Typography sx={{ fontWeight: 700, fontSize: 16, whiteSpace: 'nowrap' }}>{format(l)}</Typography>
              <IconButton size="small" onClick={() => copyText(format(l))} aria-label={`Copy ${l.label}`} sx={{ color: 'text.disabled' }}>
                <ContentCopyRounded sx={{ fontSize: 16 }} />
              </IconButton>
            </Stack>
          ))}
        {tool.id === 'change' && primary?.label === 'Change to give' && currency === 'TZS' && primary.value > 0 && (
          <Box sx={{ px: 2.5, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary">
              Give back:
            </Typography>
            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75, mt: 0.5 }}>
              {breakdown(primary.value).map((d) => (
                <Chip key={d.value} size="small" label={`${d.count} × ${d.value.toLocaleString()}`} sx={{ fontWeight: 600, bgcolor: '#ECFDF5', color: '#047857' }} />
              ))}
            </Stack>
          </Box>
        )}
      </Box>
      {result.note && hasResult && (
        <Alert severity={/below cost|not paid|owes/.test(result.note) ? 'warning' : 'info'} sx={{ mt: 1.5 }}>
          {result.note}
        </Alert>
      )}

      <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
        <Button fullWidth size="large" variant="outlined" onClick={() => setFields({ ...(tool.defaults ?? {}), ...(tool.id === 'vat' ? { rate: String(businessRate) } : {}) })}>
          Clear
        </Button>
        <Button fullWidth size="large" variant="contained" disabled={!primary} onClick={save}>
          Save to Recent
        </Button>
      </Stack>
    </Box>
  )
}

export function BusinessTools() {
  const [toolId, setToolId] = useState<string | null>(null)
  const tool = TOOLS.find((t) => t.id === toolId)
  if (tool) return <ToolView key={tool.id} tool={tool} onBack={() => setToolId(null)} />

  return (
    <Stack spacing={2.5}>
      {CATEGORIES.map((category) => (
        <Box key={category}>
          <Typography sx={{ fontSize: 12.5, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'text.secondary', mb: 1 }}>{category}</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1.25 }}>
            {TOOLS.filter((t) => t.category === category).map((t) => (
              <ButtonBase
                key={t.id}
                onClick={() => setToolId(t.id)}
                sx={{
                  justifyContent: 'flex-start',
                  alignItems: 'center',
                  gap: 1.25,
                  p: 1.5,
                  borderRadius: '14px',
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: '#fff',
                  textAlign: 'left',
                  transition: 'border-color .15s, box-shadow .15s, transform .1s',
                  '&:hover': { borderColor: t.color, boxShadow: `0 6px 16px ${t.color}22` },
                  '&:active': { transform: 'scale(0.98)' },
                }}
              >
                <Box sx={{ width: 40, height: 40, borderRadius: '12px', bgcolor: `${t.color}18`, color: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{t.icon}</Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 15 }} noWrap>
                    {t.name}
                  </Typography>
                  <Typography sx={{ fontSize: 12.5, color: 'text.secondary', lineHeight: 1.3 }}>{t.description}</Typography>
                </Box>
              </ButtonBase>
            ))}
          </Box>
        </Box>
      ))}
    </Stack>
  )
}
