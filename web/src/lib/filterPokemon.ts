import type { Pokemon } from '@/api/schemas'

/**
 * Pure client-side collection filtering (research D10). `GET /api/pokemon` returns the caller's full
 * collection; the browser slices it with these predicates — no server-side query params. Sorting is
 * the sibling concern in `./sortPokemon`.
 */

/** The five boolean markers a Pokémon can carry (mirrors `Pokemon.flags`). */
export type PokemonFlag =
  'shiny' | 'shadow' | 'lucky' | 'purified' | 'bestBuddy'

/**
 * A collection filter. Every provided field narrows the result with AND semantics; an omitted (or
 * empty) field imposes no constraint.
 */
export interface PokemonFilter {
  /** Case-insensitive substring over the species name (nicknames are unsupported — spec assumption). */
  species?: string
  /** A type name that must appear among the species' 1–2 types (dual-types match on either). */
  type?: string
  /** Flags that must all be set. */
  flags?: PokemonFlag[]
  /** When set, keeps only rows whose stale state equals this (the FR-013 rescan badge). */
  stale?: boolean
}

const matchesSpecies = (p: Pokemon, query: string): boolean => {
  const q = query.trim().toLowerCase()
  return q === '' || p.species.name.toLowerCase().includes(q)
}

const matchesType = (p: Pokemon, type: string): boolean =>
  type === '' ||
  p.species.types.some((t) => t.toLowerCase() === type.toLowerCase())

const hasFlags = (p: Pokemon, flags: PokemonFlag[]): boolean =>
  flags.every((f) => p.flags[f])

/** Apply a {@link PokemonFilter}, returning a new array (the input is never mutated). */
export const filterPokemon = (
  list: Pokemon[],
  filter: PokemonFilter,
): Pokemon[] =>
  list.filter(
    (p) =>
      (filter.species === undefined || matchesSpecies(p, filter.species)) &&
      (filter.type === undefined || matchesType(p, filter.type)) &&
      (filter.flags === undefined || hasFlags(p, filter.flags)) &&
      (filter.stale === undefined || p.stale === filter.stale),
  )
