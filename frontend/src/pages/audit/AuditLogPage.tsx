import { Box, Chip, Pagination, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { auditApi } from '../../api/endpoints/audit'

function actionColor(action: string): 'default' | 'success' | 'warning' | 'error' {
  if (action.includes('suspended') || action.includes('status_updated')) return 'warning'
  if (action.includes('extended') || action.includes('verified')) return 'success'
  if (action.includes('deleted')) return 'error'
  return 'default'
}

export function AuditLogPage() {
  const [page, setPage] = useState(1)
  const query = useQuery({ queryKey: ['audit-logs', page], queryFn: () => auditApi.list(page) })

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
        Audit Log
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        A record of sensitive actions taken in your business account — role and permission changes, license and
        status changes, and more.
      </Typography>

      <Paper variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Action</TableCell>
              <TableCell>By</TableCell>
              <TableCell>When</TableCell>
              <TableCell>Details</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {query.data?.data.map((log) => (
              <TableRow key={log.id}>
                <TableCell>
                  <Chip label={log.action} size="small" color={actionColor(log.action)} variant="outlined" />
                </TableCell>
                <TableCell>{log.user?.name ?? '—'}</TableCell>
                <TableCell>{new Date(log.created_at).toLocaleString()}</TableCell>
                <TableCell>
                  <Typography variant="caption" color="text.secondary" component="pre" sx={{ m: 0, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                    {log.new_values ? JSON.stringify(log.new_values) : '—'}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
            {query.data?.data.length === 0 && (
              <TableRow>
                <TableCell colSpan={4}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                    No audit entries yet.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      {query.data && query.data.last_page > 1 && (
        <Stack sx={{ mt: 2, alignItems: 'center' }}>
          <Pagination count={query.data.last_page} page={page} onChange={(_, p) => setPage(p)} color="primary" />
        </Stack>
      )}
    </Box>
  )
}
