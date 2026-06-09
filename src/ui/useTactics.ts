import { useEffect, useMemo } from 'react'
import { useGame, resolveValidTactics } from '../store/gameStore'
import type { Tactics } from '../data/types'

/**
 * Returns valid tactics for the current squad, rebuilding (e.g. when a starter
 * is injured/suspended) without ever calling setState during render — the
 * rebuilt value is persisted in an effect to avoid React update-in-render warnings.
 */
export function useTactics(): Tactics {
  const tactics = useGame((s) => s.tactics)
  const userTeamId = useGame((s) => s.userTeamId)
  const career = useGame((s) => s.career)
  const setTactics = useGame((s) => s.setTactics)

  const resolved = useMemo(
    () => resolveValidTactics(tactics, userTeamId, career),
    [tactics, userTeamId, career],
  )

  useEffect(() => {
    if (resolved !== tactics) setTactics(resolved)
  }, [resolved, tactics, setTactics])

  return resolved
}
