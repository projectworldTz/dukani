import {
  Add,
  AddBox,
  Download,
  Edit,
  FactCheck,
  History,
  Layers,
  Medication,
  IndeterminateCheckBox,
  Inventory2,
  MoreVert,
  QrCode2,
  Search,
  Upload,
} from '@mui/icons-material'
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  IconButton,
  InputAdornment,
  ListItemIcon,
  Menu,
  MenuItem,
  Pagination,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { productsApi } from '../../api/endpoints/products'
import { useActiveBranch } from '../../hooks/useActiveBranch'
import { usePlatform } from '../../hooks/usePlatform'
import { expiryStatus, medicineSubtitle } from '../../api/endpoints/pharmacy'
import { BatchesDialog } from './BatchesDialog'
import { formatQty, isWeighed } from '../../utils/quantity'
import { useAuthStore } from '../../stores/authStore'
import type { Product } from '../../types'
import { ProductFormDialog } from './ProductFormDialog'
import { StockDialog, type StockAction } from './StockDialog'
import { StockHistoryDialog } from './StockHistoryDialog'

type StockFilter = 'all' | 'low' | 'out' | 'expiring' | 'expired'

/** Units that can actually be sold — expired medicine doesn't count. */
const sellable = (p: Product) => Math.max(0, (p.available_stock ?? 0) - (p.expired_stock ?? 0))

/** Rx / controlled-drug badges shown next to a medicine's name. */
function MedicineBadges({ product }: { product: Product }) {
  return (
    <>
      {product.requires_prescription && <Chip label="Rx" size="small" color="primary" sx={{ height: 20, fontSize: 11, fontWeight: 800, ml: 0.75 }} />}
      {product.is_controlled && <Chip label="CD" size="small" color="error" sx={{ height: 20, fontSize: 11, fontWeight: 800, ml: 0.5 }} title="Controlled drug" />}
    </>
  )
}

function ExpiryChip({ date }: { date?: string | null }) {
  if (!date) return <Typography variant="caption" color="text.disabled">—</Typography>
  const s = expiryStatus(date)
  return <Chip label={s.label} size="small" color={s.color} variant={s.color === 'success' ? 'outlined' : 'filled'} sx={{ fontWeight: 600 }} />
}

function StockBadge({ product }: { product: Product }) {
  const qty = sellable(product)
  if (qty <= 0) return <Chip label="Out of stock" size="small" color="error" />
  if (qty <= (product.reorder_level ?? 0)) return <Chip label="Low stock" size="small" color="warning" />
  return <Chip label="In stock" size="small" color="success" variant="outlined" />
}

function useDebounced<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export function ProductsPage() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const queryClient = useQueryClient()
  const { user, hasPermission } = useAuthStore()
  const currency = user?.business?.currency ?? ''
  const canAdjust = hasPermission('inventory.adjust')
  const advanced = !!user?.business?.advanced_features
  const { branchId: defaultBranchId, branches, isMultiBranch } = useActiveBranch()
  const { isPharmacy, isButchery } = usePlatform()
  const noun = isPharmacy ? 'medicine' : 'product'
  const [batchesProduct, setBatchesProduct] = useState<Product | null>(null)

  const [searchParams, setSearchParams] = useSearchParams()
  const allowedFilters = isPharmacy ? ['low', 'out', 'expiring', 'expired'] : ['low', 'out']
  const filter = (allowedFilters.includes(searchParams.get('stock') ?? '') ? searchParams.get('stock') : 'all') as StockFilter
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounced(search)
  const [page, setPage] = useState(1)
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null)
  const branchId = selectedBranch ?? defaultBranchId

  const [formOpen, setFormOpen] = useState(() => searchParams.get('new') === '1')
  const [editing, setEditing] = useState<Product | null>(null)
  const [stockAction, setStockAction] = useState<{ action: StockAction; product: Product } | null>(null)
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null)
  const [rowMenu, setRowMenu] = useState<{ anchor: HTMLElement; product: Product } | null>(null)
  const [pageMenu, setPageMenu] = useState<HTMLElement | null>(null)
  const [importResult, setImportResult] = useState<{ created: number; errors: string[] } | null>(null)

  const productsQuery = useQuery({
    queryKey: ['products', 'stock-list', { search: debouncedSearch, filter, branchId, page }],
    queryFn: () =>
      productsApi.list({
        search: debouncedSearch || undefined,
        branch_id: branchId ?? undefined,
        stock: filter === 'low' || filter === 'out' ? filter : undefined,
        expiry: filter === 'expiring' || filter === 'expired' ? filter : undefined,
        page,
        per_page: 25,
      }),
    enabled: !!branchId,
    placeholderData: (prev) => prev,
  })
  // Counts for the filter tabs, so the shop owner sees at a glance what needs attention.
  const lowCountQuery = useQuery({
    queryKey: ['products', 'count', 'low', branchId],
    queryFn: () => productsApi.list({ branch_id: branchId!, stock: 'low', per_page: 1 }),
    enabled: !!branchId,
  })
  const outCountQuery = useQuery({
    queryKey: ['products', 'count', 'out', branchId],
    queryFn: () => productsApi.list({ branch_id: branchId!, stock: 'out', per_page: 1 }),
    enabled: !!branchId,
  })

  const expiringCountQuery = useQuery({
    queryKey: ['products', 'count', 'expiring', branchId],
    queryFn: () => productsApi.list({ branch_id: branchId!, expiry: 'expiring', per_page: 1 }),
    enabled: !!branchId && isPharmacy,
  })
  const expiredCountQuery = useQuery({
    queryKey: ['products', 'count', 'expired', branchId],
    queryFn: () => productsApi.list({ branch_id: branchId!, expiry: 'expired', per_page: 1 }),
    enabled: !!branchId && isPharmacy,
  })
  const expiringCount = expiringCountQuery.data?.meta?.total ?? 0
  const expiredCount = expiredCountQuery.data?.meta?.total ?? 0

  const products = useMemo(() => productsQuery.data?.data ?? [], [productsQuery.data])

  // Deep link from the dashboard's Stock Alert "Restock" button.
  const restockId = Number(searchParams.get('restock')) || null
  useEffect(() => {
    if (!restockId || !canAdjust) return
    const product = products.find((p) => p.id === restockId)
    if (!product) return
    setStockAction({ action: 'add', product })
    const next = new URLSearchParams(searchParams)
    next.delete('restock')
    setSearchParams(next, { replace: true })
  }, [restockId, canAdjust, products, searchParams, setSearchParams])
  const lastPage = productsQuery.data?.meta?.last_page ?? 1
  const lowCount = lowCountQuery.data?.meta?.total ?? 0
  const outCount = outCountQuery.data?.meta?.total ?? 0

  const exportMutation = useMutation({
    mutationFn: () => productsApi.exportCsvBlobUrl(),
    onSuccess: (url) => {
      const a = document.createElement('a')
      a.href = url
      a.download = 'products.csv'
      a.click()
    },
    meta: { successMessage: 'Export ready.' },
  })
  const importMutation = useMutation({
    mutationFn: (file: File) => productsApi.importCsv(file),
    onSuccess: (result) => {
      setImportResult(result)
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
  const labelMutation = useMutation({
    mutationFn: (ids: number[]) => productsApi.labelsPdfBlobUrl(ids, 1, 'medium', false),
    onSuccess: (url) => window.open(url, '_blank'),
  })

  const money = (v: string | number) => `${currency} ${Number(v).toLocaleString()}`
  const openStock = (action: StockAction, product: Product) => setStockAction({ action, product })
  const openAdd = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const rowActions = (product: Product) => (
    <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', alignItems: 'center' }}>
      {canAdjust && (
        <>
          <Button size="small" variant="contained" disableElevation startIcon={<AddBox />} onClick={() => openStock('add', product)}>
            {isPharmacy ? 'Receive' : 'Add stock'}
          </Button>
          <Button size="small" variant="outlined" startIcon={<FactCheck />} onClick={() => openStock('count', product)} sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
            Fix count
          </Button>
        </>
      )}
      <IconButton aria-label="More actions" onClick={(e) => setRowMenu({ anchor: e.currentTarget, product })}>
        <MoreVert />
      </IconButton>
    </Stack>
  )

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' }, mb: 2.5 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            {isPharmacy ? 'Medicines' : 'Products & Stock'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {isPharmacy ? 'Every medicine you stock, with batches and expiry dates.' : 'Everything you sell, and how many you have left.'}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="contained" size="large" startIcon={<Add />} onClick={openAdd} sx={{ flexGrow: { xs: 1, sm: 0 } }}>
            Add {noun}
          </Button>
          <IconButton aria-label="More options" onClick={(e) => setPageMenu(e.currentTarget)} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
            <MoreVert />
          </IconButton>
        </Stack>
      </Stack>

      {importResult && (
        <Alert severity={importResult.errors.length ? 'warning' : 'success'} onClose={() => setImportResult(null)} sx={{ mb: 2 }}>
          Imported {importResult.created} product(s).
          {importResult.errors.length > 0 && ` ${importResult.errors.length} row(s) skipped: ${importResult.errors.join('; ')}`}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ mb: 2, borderRadius: 3, overflow: 'hidden' }}>
        <Tabs
          value={filter}
          onChange={(_, v: StockFilter) => {
            const next = new URLSearchParams(searchParams)
            if (v === 'all') next.delete('stock')
            else next.set('stock', v)
            setSearchParams(next, { replace: true })
            setPage(1)
          }}
          variant={isMobile && !isPharmacy ? 'fullWidth' : 'scrollable'}
          allowScrollButtonsMobile
          sx={{ px: 1, borderBottom: '1px solid', borderColor: 'divider', '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, minHeight: 52 } }}
        >
          <Tab value="all" label={isMobile ? 'All' : isPharmacy ? 'All medicines' : 'All products'} />
          <Tab value="low" label={<Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}><span>{isMobile ? 'Low' : 'Low stock'}</span>{lowCount > 0 && <Chip label={lowCount} size="small" color="warning" />}</Stack>} />
          <Tab value="out" label={<Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}><span>{isMobile ? 'Out' : 'Out of stock'}</span>{outCount > 0 && <Chip label={outCount} size="small" color="error" />}</Stack>} />
          {isPharmacy && (
            <Tab value="expiring" label={<Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}><span>{isMobile ? 'Expiring' : 'Expiring soon'}</span>{expiringCount > 0 && <Chip label={expiringCount} size="small" color="warning" />}</Stack>} />
          )}
          {isPharmacy && (
            <Tab value="expired" label={<Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}><span>Expired</span>{expiredCount > 0 && <Chip label={expiredCount} size="small" color="error" />}</Stack>} />
          )}
        </Tabs>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ p: 1.5 }}>
          <TextField
            placeholder={isPharmacy ? 'Search by brand or generic name, or scan a barcode…' : 'Search by name or scan a barcode…'}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            fullWidth
            size="small"
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search /></InputAdornment> } }}
          />
          {advanced && isMultiBranch && (
            <TextField select size="small" label="Branch" value={branchId ?? ''} onChange={(e) => {
                setSelectedBranch(Number(e.target.value))
                setPage(1)
              }} sx={{ minWidth: 200 }}>
              {branches.map((b) => (
                <MenuItem key={b.id} value={b.id}>
                  {b.name}
                </MenuItem>
              ))}
            </TextField>
          )}
        </Stack>
      </Paper>

      {productsQuery.isSuccess && products.length === 0 && (
        <Paper variant="outlined" sx={{ p: { xs: 4, sm: 6 }, textAlign: 'center', borderRadius: 3, borderStyle: 'dashed' }}>
          {isPharmacy ? <Medication sx={{ fontSize: 56, color: 'text.disabled', mb: 1 }} /> : <Inventory2 sx={{ fontSize: 56, color: 'text.disabled', mb: 1 }} />}
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {debouncedSearch
              ? `No ${noun}s match your search`
              : filter === 'all'
                ? `No ${noun}s yet`
                : filter === 'low'
                  ? 'Nothing is running low'
                  : filter === 'out'
                    ? 'Nothing is out of stock'
                    : filter === 'expiring'
                      ? 'Nothing expires in the next 90 days'
                      : 'No expired stock'}
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            {filter === 'all' && !debouncedSearch
              ? isPharmacy
                ? 'Add each medicine with its batch number and expiry date.'
                : 'Add the things you sell. It only takes a few seconds per product.'
              : 'Great — keep it up!'}
          </Typography>
          {filter === 'all' && !debouncedSearch && (
            <Button variant="contained" size="large" startIcon={<Add />} onClick={openAdd}>
              Add your first {noun}
            </Button>
          )}
        </Paper>
      )}

      {products.length > 0 &&
        (isMobile ? (
          <Stack spacing={1.25}>
            {products.map((product) => (
              <Card key={product.id} variant="outlined" sx={{ p: 1.75, borderRadius: 3 }}>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography component="div" sx={{ fontWeight: 700 }} noWrap>
                      {product.name}
                      {isPharmacy && <MedicineBadges product={product} />}
                    </Typography>
                    {isPharmacy && medicineSubtitle(product) && (
                      <Typography variant="caption" color="text.secondary" noWrap component="div">
                        {medicineSubtitle(product)}
                      </Typography>
                    )}
                    <Typography variant="body2" color="text.secondary">
                      {money(product.selling_price)}{isWeighed(product) ? ' /kg' : ''}
                    </Typography>
                    {isPharmacy && (
                      <Box sx={{ mt: 0.5 }}>
                        <ExpiryChip date={product.nearest_expiry} />
                      </Box>
                    )}
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                      {formatQty(sellable(product), isWeighed(product))}
                    </Typography>
                    <StockBadge product={product} />
                    {(product.expired_stock ?? 0) > 0 && (
                      <Typography variant="caption" color="error" sx={{ display: 'block', fontWeight: 600 }}>
                        +{product.expired_stock} expired
                      </Typography>
                    )}
                  </Box>
                </Stack>
                <Box sx={{ mt: 1.5 }}>{rowActions(product)}</Box>
              </Card>
            ))}
          </Stack>
        ) : (
          <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
            <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', '& th, & td': { px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider', textAlign: 'left' }, '& th': { fontSize: 13, color: 'text.secondary', fontWeight: 700, bgcolor: 'grey.50' }, '& tbody tr:hover': { bgcolor: 'action.hover' }, '& tbody tr:last-of-type td': { borderBottom: 0 } }}>
              <thead>
                <tr>
                  <th>{isPharmacy ? 'Medicine' : 'Product'}</th>
                  <th style={{ textAlign: 'right' }}>Price</th>
                  <th style={{ textAlign: 'right' }}>{isPharmacy ? 'Can sell' : 'In stock'}</th>
                  {isPharmacy && <th>Next expiry</th>}
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <Typography component="div" sx={{ fontWeight: 700 }}>
                        {product.name}
                        {isPharmacy && <MedicineBadges product={product} />}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {(isPharmacy ? medicineSubtitle(product) : '') || [product.category?.name, product.barcodes[0]?.code].filter(Boolean).join(' · ') || '—'}
                      </Typography>
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <Typography sx={{ fontWeight: 600 }}>{money(product.selling_price)}{isWeighed(product) ? ' /kg' : ''}</Typography>
                      <Tooltip title="Buying price">
                        <Typography variant="caption" color="text.secondary">
                          cost {Number(product.cost_price).toLocaleString()}
                        </Typography>
                      </Tooltip>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Typography variant="h6" sx={{ fontWeight: 800 }}>
                        {formatQty(sellable(product), isWeighed(product))}
                      </Typography>
                      {(product.expired_stock ?? 0) > 0 && (
                        <Typography variant="caption" color="error" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                          +{product.expired_stock} expired
                        </Typography>
                      )}
                    </td>
                    {isPharmacy && (
                      <td>
                        <ExpiryChip date={product.nearest_expiry} />
                      </td>
                    )}
                    <td>
                      <StockBadge product={product} />
                    </td>
                    <td>{rowActions(product)}</td>
                  </tr>
                ))}
              </tbody>
            </Box>
          </Paper>
        ))}

      {lastPage > 1 && (
        <Stack sx={{ alignItems: 'center', mt: 2 }}>
          <Pagination count={lastPage} page={page} onChange={(_, p) => setPage(p)} color="primary" />
        </Stack>
      )}

      <Menu anchorEl={rowMenu?.anchor} open={!!rowMenu} onClose={() => setRowMenu(null)}>
        {canAdjust && (
          <MenuItem
            onClick={() => {
              openStock('count', rowMenu!.product)
              setRowMenu(null)
            }}
            sx={{ display: { sm: 'none' } }}
          >
            <ListItemIcon><FactCheck fontSize="small" /></ListItemIcon>
            Fix count
          </MenuItem>
        )}
        {canAdjust && (
          <MenuItem
            onClick={() => {
              openStock('remove', rowMenu!.product)
              setRowMenu(null)
            }}
          >
            <ListItemIcon><IndeterminateCheckBox fontSize="small" /></ListItemIcon>
            {isPharmacy ? 'Remove expired / damaged' : isButchery ? 'Record waste / spoilage' : 'Remove damaged / lost'}
          </MenuItem>
        )}
        {isPharmacy && (
          <MenuItem
            onClick={() => {
              setBatchesProduct(rowMenu!.product)
              setRowMenu(null)
            }}
          >
            <ListItemIcon><Layers fontSize="small" /></ListItemIcon>
            Batches & expiry dates
          </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            setHistoryProduct(rowMenu!.product)
            setRowMenu(null)
          }}
        >
          <ListItemIcon><History fontSize="small" /></ListItemIcon>
          Stock history
        </MenuItem>
        <MenuItem
          onClick={() => {
            setEditing(rowMenu!.product)
            setFormOpen(true)
            setRowMenu(null)
          }}
        >
          <ListItemIcon><Edit fontSize="small" /></ListItemIcon>
          Edit product
        </MenuItem>
        <MenuItem
          onClick={() => {
            labelMutation.mutate([rowMenu!.product.id])
            setRowMenu(null)
          }}
        >
          <ListItemIcon><QrCode2 fontSize="small" /></ListItemIcon>
          Print barcode label
        </MenuItem>
      </Menu>

      <Menu anchorEl={pageMenu} open={!!pageMenu} onClose={() => setPageMenu(null)}>
        <MenuItem component="label">
          <ListItemIcon><Upload fontSize="small" /></ListItemIcon>
          Import products from CSV
          <input
            type="file"
            hidden
            accept=".csv"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) importMutation.mutate(file)
              e.target.value = ''
              setPageMenu(null)
            }}
          />
        </MenuItem>
        <MenuItem
          onClick={() => {
            exportMutation.mutate()
            setPageMenu(null)
          }}
        >
          <ListItemIcon><Download fontSize="small" /></ListItemIcon>
          Export products to CSV
        </MenuItem>
        <MenuItem
          disabled={products.length === 0}
          onClick={() => {
            labelMutation.mutate(products.map((p) => p.id))
            setPageMenu(null)
          }}
        >
          <ListItemIcon><QrCode2 fontSize="small" /></ListItemIcon>
          Print labels for this page
        </MenuItem>
      </Menu>

      <ProductFormDialog open={formOpen} product={editing} branchId={branchId} onClose={() => setFormOpen(false)} />
      <StockDialog
        open={!!stockAction}
        action={stockAction?.action ?? 'add'}
        product={stockAction?.product ?? null}
        branchId={branchId}
        onClose={() => setStockAction(null)}
      />
      <StockHistoryDialog open={!!historyProduct} product={historyProduct} onClose={() => setHistoryProduct(null)} />
      {isPharmacy && <BatchesDialog product={batchesProduct} branchId={branchId} onClose={() => setBatchesProduct(null)} />}
    </Box>
  )
}
