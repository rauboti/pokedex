import type { Pokemon } from '@/api/schemas'

/** Pure client-side collection filtering — there are no server-side query params. */

export type PokemonFlag =
  'shiny' | 'shadow' | 'lucky' | 'purified' | 'bestBuddy'

/** Fields combine with AND; an omitted or empty field imposes no constraint. */
export interface PokemonFilter {
  /** Case-insensitive substring over the species name; there are no nicknames. */
  species?: string
  /** OR semantics — a dual-type matches on either of its types. */
  types?: string[]
  flags?: PokemonFlag[]
  /** Keeps only rows whose stale state equals this. */
  stale?: boolean
}

const matchesSpecies = (p: Pokemon, query: string): boolean => {
  const q = query.trim().toLowerCase()
  return q === '' || p.species.name.toLowerCase().includes(q)
}

const matchesTypes = (p: Pokemon, types: string[]): boolean =>
  types.length === 0 ||
  types.some((type) =>
    p.species.types.some((t) => t.toLowerCase() === type.toLowerCase()),
  )

const hasFlags = (p: Pokemon, flags: PokemonFlag[]): boolean =>
  flags.every((f) => p.flags[f])

/** Non-mutating. */
export const filterPokemon = (
  list: Pokemon[],
  filter: PokemonFilter,
): Pokemon[] =>
  list.filter(
    (p) =>
      (filter.species === undefined || matchesSpecies(p, filter.species)) &&
      (filter.types === undefined || matchesTypes(p, filter.types)) &&
      (filter.flags === undefined || hasFlags(p, filter.flags)) &&
      (filter.stale === undefined || p.stale === filter.stale),
  )

/** Picks the right empty state. Sort is always set, so it never counts as a constraint. */
export const hasActiveFilters = (filter: PokemonFilter): boolean =>
  !!filter.species?.trim() ||
  (filter.types?.length ?? 0) > 0 ||
  (filter.flags?.length ?? 0) > 0 ||
  filter.stale !== undefined
