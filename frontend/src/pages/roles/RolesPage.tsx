import { Lock } from '@mui/icons-material'
import {
  Box,
  Checkbox,
  Chip,
  FormControlLabel,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { rbacApi } from '../../api/endpoints/rbac'

export function RolesPage() {
  const queryClient = useQueryClient()
  const [activeRoleId, setActiveRoleId] = useState<number | null>(null)

  const rolesQuery = useQuery({ queryKey: ['roles'], queryFn: rbacApi.roles })
  const catalogQuery = useQuery({ queryKey: ['permission-catalog'], queryFn: rbacApi.catalog })

  const updateMutation = useMutation({
    mutationFn: ({ roleId, permissions }: { roleId: number; permissions: string[] }) =>
      rbacApi.updatePermissions(roleId, permissions),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['roles'] }),
    meta: { successMessage: 'Permissions updated.' },
  })

  const limitMutation = useMutation({
    mutationFn: ({ roleId, key, value }: { roleId: number; key: string; value: number }) => rbacApi.setLimit(roleId, key, value),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['roles'] }),
    meta: { successMessage: 'Approval limit updated.' },
  })

  const roles = rolesQuery.data ?? []
  const role = roles.find((r) => r.id === activeRoleId) ?? roles[0]

  function togglePermission(permission: string) {
    if (!role || role.is_protected) return
    const next = role.permissions.includes(permission)
      ? role.permissions.filter((p) => p !== permission)
      : [...role.permissions, permission]
    updateMutation.mutate({ roleId: role.id, permissions: next })
  }

  const discountLimit = role?.limits.find((l) => l.key === 'max_discount_percent')?.value ?? ''

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 800 }} gutterBottom>
        Roles & Permissions
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Customize exactly what each role can access. The Business Owner role always has full access and can't be edited.
      </Typography>

      <Tabs value={role?.id ?? false} onChange={(_, v) => setActiveRoleId(v)} sx={{ mb: 2 }}>
        {roles.map((r) => (
          <Tab key={r.id} value={r.id} label={r.name} icon={r.is_protected ? <Lock fontSize="small" /> : undefined} iconPosition="end" />
        ))}
      </Tabs>

      {role && (
        <Stack spacing={3}>
          {role.is_protected && (
            <Chip icon={<Lock fontSize="small" />} label="Protected — always has every permission" color="primary" variant="outlined" sx={{ width: 'fit-content' }} />
          )}

          {catalogQuery.data &&
            Object.entries(catalogQuery.data).map(([module, permissions]) => (
              <Paper key={module} variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, textTransform: 'capitalize' }}>
                  {module}
                </Typography>
                <Stack>
                  {Object.entries(permissions).map(([name, description]) => (
                    <FormControlLabel
                      key={name}
                      control={
                        <Checkbox
                          checked={role.is_protected || role.permissions.includes(name)}
                          disabled={role.is_protected}
                          onChange={() => togglePermission(name)}
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2">{name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {description}
                          </Typography>
                        </Box>
                      }
                    />
                  ))}
                </Stack>
              </Paper>
            ))}

          {!role.is_protected && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }} gutterBottom>
                Approval limits
              </Typography>
              <TextField
                label="Max discount %"
                type="number"
                size="small"
                defaultValue={discountLimit}
                onBlur={(e) => {
                  const value = Number(e.target.value)
                  if (!Number.isNaN(value)) {
                    limitMutation.mutate({ roleId: role.id, key: 'max_discount_percent', value })
                  }
                }}
                helperText="Leave blank for no cap. E.g. 10 = Manager can approve up to 10% off."
                sx={{ width: 320 }}
              />
            </Paper>
          )}
        </Stack>
      )}
    </Box>
  )
}
