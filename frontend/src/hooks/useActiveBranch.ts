import { useQuery } from '@tanstack/react-query'
import { branchesApi } from '../api/endpoints/branches'
import { useAuthStore } from '../stores/authStore'

/**
 * The branch a simple-mode screen should work against without asking: the user's own
 * assigned branch, otherwise the business's main branch. Most small shops have
 * exactly one branch, so they never see a branch picker at all.
 */
export function useActiveBranch() {
  const assignedBranchId = useAuthStore((s) => s.user?.branch_id ?? null)
  const query = useQuery({ queryKey: ['branches'], queryFn: branchesApi.list })
  const branches = query.data ?? []
  const fallback = branches.find((b) => b.is_main) ?? branches[0]

  return {
    branchId: assignedBranchId ?? fallback?.id ?? null,
    branches,
    isMultiBranch: branches.length > 1,
    isLoading: query.isLoading,
  }
}
