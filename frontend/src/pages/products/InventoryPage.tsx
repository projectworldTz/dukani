import { Box, Chip, FormControlLabel, Paper, Switch, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { inventoryApi } from '../../api/endpoints/inventory'

interface InventoryRow {
  id: number
  quantity: number
  reorder_level: number | null
  product: { id: number; name: string; sku: string | null; reorder_level: number }
  branch: { id: number; name: string }
}

export function InventoryPage() {
  const [lowStockOnly, setLowStockOnly] = useState(false)

  const query = useQuery({
    queryKey: ['inventory', lowStockOnly],
    queryFn: () => inventoryApi.list({ low_stock: lowStockOnly || undefined }),
  })

  const rows: InventoryRow[] = query.data?.data ?? []

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 800 }} gutterBottom>
        Inventory
      </Typography>
      <FormControlLabel
        control={<Switch checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} />}
        label="Low stock only"
        sx={{ mb: 2 }}
      />

      <Paper variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Product</TableCell>
              <TableCell>Branch</TableCell>
              <TableCell align="right">Quantity</TableCell>
              <TableCell align="right">Reorder level</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => {
              const reorderLevel = row.reorder_level ?? row.product.reorder_level
              const isLow = row.quantity <= reorderLevel
              return (
                <TableRow key={row.id}>
                  <TableCell>
                    {row.product.name}
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {row.product.sku}
                    </Typography>
                  </TableCell>
                  <TableCell>{row.branch.name}</TableCell>
                  <TableCell align="right">{row.quantity}</TableCell>
                  <TableCell align="right">{reorderLevel}</TableCell>
                  <TableCell>
                    {row.quantity === 0 ? (
                      <Chip label="Out of stock" size="small" color="error" />
                    ) : isLow ? (
                      <Chip label="Low stock" size="small" color="warning" />
                    ) : (
                      <Chip label="OK" size="small" color="success" variant="outlined" />
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  )
}
