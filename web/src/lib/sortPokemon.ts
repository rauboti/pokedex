import type { Pokemon } from '@/api/schemas'

/** Pure client-side collection sorting: one column at a time, stable, non-mutating. */

export type SortKey = 'ivPercent' | 'cp' | 'level' | 'caughtAt' | 'name'
export type SortDirection = 'asc' | 'desc'

export interface SortCriteria {
  key: SortKey
  direction: SortDirection
}

// ISO-8601 sorts chronologically under plain string comparison, so dates and names share a path.
const compareStrings = (a: string, b: string): number =>
  a < b ? -1 : a > b ? 1 : 0

/**
 * Stability is enforced by an explicit index tiebreak rather than trusting the engine. `caughtAt`
 * nulls sort last in *both* directions, and `name` breaks ties on form so a base form leads its
 * regional variants.
 */
export const sortPokemon = (
  list: Pokemon[],
  { key, direction }: SortCriteria,
): Pokemon[] => {
  const dir = direction === 'asc' ? 1 : -1

  const compare = (a: Pokemon, b: Pokemon): number => {
    switch (key) {
      case 'ivPercent':
        return dir * (a.derived.ivPercent - b.derived.ivPercent)
      case 'cp':
        return dir * (a.cp - b.cp)
      case 'level':
        return dir * (a.derived.level - b.derived.level)
      case 'caughtAt': {
        // Nulls last regardless of direction: only the non-null pair obeys `dir`.
        if (a.caughtAt === null && b.caughtAt === null) return 0
        if (a.caughtAt === null) return 1
        if (b.caughtAt === null) return -1
        return dir * compareStrings(a.caughtAt, b.caughtAt)
      }
      case 'name': {
        const byName = compareStrings(a.species.name, b.species.name)
        const byForm =
          byName !== 0
            ? byName
            : compareStrings(a.species.form ?? '', b.species.form ?? '')
        return dir * byForm
      }
    }
  }

  return list
    .map((p, i) => ({ p, i }))
    .sort((x, y) => compare(x.p, y.p) || x.i - y.i)
    .map(({ p }) => p)
}
