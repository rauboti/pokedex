import type { Projection } from '@/api/schemas'
import type { StatRow } from './StatTable'

/** Pure DTO→row mapping, split out so the panel file stays component-only (react-refresh). */

const LABELS: Record<Projection['label'], string> = {
  L40: 'L40',
  L50: 'L50',
  BEST_BUDDY: 'Best Buddy',
}

export const projectionRows = (projections: Projection[]): StatRow[] =>
  projections.map((p) => ({
    target: LABELS[p.label],
    level: p.level,
    cp: p.cp,
    hp: p.hp,
    attack: p.attack,
    defense: p.defense,
    stamina: p.stamina,
  }))
