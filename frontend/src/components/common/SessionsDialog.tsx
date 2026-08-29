import { Devices, LogoutRounded } from '@mui/icons-material'
import {
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { authApi } from '../../api/endpoints/auth'
import { useToastStore } from '../../stores/toastStore'

export function SessionsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['auth-sessions'], queryFn: authApi.sessions, enabled: open })

  const revoke = useMutation({
    mutationFn: (id: number) => authApi.revokeSession(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth-sessions'] })
      useToastStore.getState().show('Session revoked.', 'success')
    },
  })

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Active sessions</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Devices currently signed in to your Dukani account.
        </Typography>
        <List disablePadding>
          {query.data?.map((session) => (
            <ListItem
              key={session.id}
              disableGutters
              secondaryAction={
                !session.is_current && (
                  <IconButton edge="end" disabled={revoke.isPending} onClick={() => revoke.mutate(session.id)}>
                    <LogoutRounded fontSize="small" />
                  </IconButton>
                )
              }
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                <Devices fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={
                  <>
                    {session.name} {session.is_current && <Chip label="This device" size="small" color="success" sx={{ ml: 1 }} />}
                  </>
                }
                secondary={session.last_used_at ? `Last used ${new Date(session.last_used_at).toLocaleString()}` : 'Never used'}
              />
            </ListItem>
          ))}
        </List>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
