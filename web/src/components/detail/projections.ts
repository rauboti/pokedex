import type { Projection } from '@/api/schemas'

/**
 * Pure DTO→display mapping for the level projections (US3). The panel feeds these rows to the Grid
 * verbatim; kept in its own module so the panel file stays component-only (react-refresh).
 */

const LABELS: Record<Projection['label'], string> = {
  L40: 'L40',
  L50: 'L50',
  BEST_BUDDY: 'Best Buddy',
}

export type ProjectionRow = {
  target: string
  level: number
  cp: number
  hp: number
  attack: number
  defense: number
  stamina: number
}

export const projectionRows = (projections: Projection[]): ProjectionRow[] =>
  projections.map((p) => ({
    target: LABELS[p.label],
    level: p.level,
    cp: p.cp,
    hp: p.hp,
    attack: p.attack,
    defense: p.defense,
    stamina: p.stamina,
  }))
