import type { Pokemon } from '@/api/schemas'

/**
 * Pure client-side collection sorting (research D10) — the sibling of `./filterPokemon`. One column
 * at a time, stable, non-mutating.
 */

/** Sortable columns for the collection. */
export type SortKey = 'ivPercent' | 'cp' | 'level' | 'caughtAt' | 'name'
export type SortDirection = 'asc' | 'desc'

export interface SortCriteria {
  key: SortKey
  direction: SortDirection
}

// ISO-8601 strings compare lexicographically in chronological order, so plain string comparison
// works for both `caughtAt` timestamps and names.
const compareStrings = (a: string, b: string): number =>
  a < b ? -1 : a > b ? 1 : 0

/**
 * Sort a collection by one column, returning a new array (the input is never mutated). The sort is
 * stable — rows equal on the key keep their original order, enforced by an index tiebreak rather
 * than relying on the engine. `caughtAt` nulls always sort last, in both directions; `name` breaks
 * ties on form so a base form precedes its regional variants (nicknames are unsupported — spec
 * assumption).
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
