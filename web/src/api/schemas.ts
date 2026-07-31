import { z } from 'zod'
import { apiRequest, type ApiRequestOptions } from './client'

/**
 * Typed client for the pokedex API: one Zod schema and one function per contract operation. Every
 * schema mirrors its OpenAPI counterpart, and the `Derived` block is read, never computed here.
 */

/** `types` is 1–2 canonical type names; `form` is null for the base form. */
export const speciesSchema = z.object({
  id: z.string(),
  dexNr: z.number(),
  name: z.string(),
  form: z.string().nullable(),
  types: z.array(z.string()).min(1).max(2),
  baseAtk: z.number(),
  baseDef: z.number(),
  baseSta: z.number(),
  imageUrl: z.string().nullable().optional(),
  shinyImageUrl: z.string().nullable().optional(),
  rarity: z.string().nullable().optional(),
  syncedAt: z.string(),
})
export type Species = z.infer<typeof speciesSchema>

/** `legacy` is a real boolean on pool listings but `null` on recorded moves, hence `nullish` —
 *  without it a recorded move would fail validation. */
export const moveSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  fast: z.boolean(),
  legacy: z.boolean().nullish(),
})
export type Move = z.infer<typeof moveSchema>

/** `recommended` is null when the pool yields no pairing. */
export const speciesMovesSchema = z.object({
  speciesId: z.string(),
  fastMoves: z.array(moveSchema),
  chargedMoves: z.array(moveSchema),
  recommended: z
    .object({ fastMoveId: z.string(), chargedMoveId: z.string() })
    .nullable(),
})
export type SpeciesMoves = z.infer<typeof speciesMovesSchema>

/** `dustCost` is a per-candidate hint, not the collision disambiguator — it is equal across
 *  candidates on the CP-floor plateau, where collisions actually occur. */
export const derivationCandidateSchema = z.object({
  level: z.number(),
  hp: z.number(),
  attack: z.number(),
  defense: z.number(),
  stamina: z.number(),
  dustCost: z.number(),
})
export type DerivationCandidate = z.infer<typeof derivationCandidateSchema>

export const derivationResultSchema = z.object({
  candidates: z.array(derivationCandidateSchema),
})
export type DerivationResult = z.infer<typeof derivationResultSchema>

export type DerivationRequest = {
  speciesId: string
  ivAtk: number
  ivDef: number
  ivSta: number
  cp: number
}

/** L40/L50 always, Best Buddy only when flagged. */
export const projectionSchema = z.object({
  label: z.enum(['L40', 'L50', 'BEST_BUDDY']),
  level: z.number(),
  cp: z.number(),
  hp: z.number(),
  attack: z.number(),
  defense: z.number(),
  stamina: z.number(),
})
export type Projection = z.infer<typeof projectionSchema>

/** Server-computed — the SPA does no stat math. */
export const derivedSchema = z.object({
  level: z.number(),
  hp: z.number(),
  attack: z.number(),
  defense: z.number(),
  stamina: z.number(),
  ivPercent: z.number(),
  perfect: z.boolean(),
  projections: z.array(projectionSchema),
})
export type Derived = z.infer<typeof derivedSchema>

/** Null moves mean unrecorded; `stale` is set by the post-sync rescan. */
export const pokemonSchema = z.object({
  id: z.string(),
  species: speciesSchema,
  ivAtk: z.number(),
  ivDef: z.number(),
  ivSta: z.number(),
  cp: z.number(),
  flags: z.object({
    shiny: z.boolean(),
    shadow: z.boolean(),
    lucky: z.boolean(),
    purified: z.boolean(),
    bestBuddy: z.boolean(),
  }),
  moves: z.object({
    fast: moveSchema.nullable(),
    charged1: moveSchema.nullable(),
    charged2: moveSchema.nullable(),
  }),
  derived: derivedSchema,
  stale: z.boolean(),
  caughtAt: z.string().nullable(),
  createdAt: z.string(),
})
export type Pokemon = z.infer<typeof pokemonSchema>

export const pokemonListSchema = z.array(pokemonSchema)

/** `level` is required only when the derivation is ambiguous, and must then be a candidate. */
export type PokemonInput = {
  speciesId: string
  ivAtk: number
  ivDef: number
  ivSta: number
  cp: number
  level?: number | null
  shiny?: boolean
  shadow?: boolean
  lucky?: boolean
  purified?: boolean
  bestBuddy?: boolean
  fastMoveId?: string | null
  chargedMove1Id?: string | null
  chargedMove2Id?: string | null
  caughtAt?: string | null
}

export type PokemonPatch = Partial<PokemonInput>

/** `syncedAt` is null until the first sync; `stalePokemonCount` is the caller's own. */
export const catalogStatusSchema = z.object({
  speciesCount: z.number(),
  moveCount: z.number(),
  syncedAt: z.string().nullable(),
  stalePokemonCount: z.number(),
})
export type CatalogStatus = z.infer<typeof catalogStatusSchema>

/** An empty `roles` list means signed in but without pokedex access. */
export const meSchema = z.object({
  sub: z.string(),
  name: z.string().nullable().optional(),
  roles: z.array(z.string()),
})
export type Me = z.infer<typeof meSchema>

// --- Species ---------------------------------------------------------------

/** Registrable species only — megas and temporary forms are excluded server-side. */
export const searchSpecies = (
  q: string,
  limit?: number,
  signal?: AbortSignal,
): Promise<Species[]> => {
  const query = new URLSearchParams({ q })
  if (limit !== undefined) query.set('limit', String(limit))
  return apiRequest(`/species?${query}`, z.array(speciesSchema), { signal })
}

export const getSpeciesMoves = (
  id: string,
  signal?: AbortSignal,
): Promise<SpeciesMoves> =>
  apiRequest(`/species/${id}/moves`, speciesMovesSchema, { signal })

// --- Derivation & Pokémon --------------------------------------------------

export const derive = (input: DerivationRequest): Promise<DerivationResult> =>
  apiRequest('/derivation', derivationResultSchema, {
    method: 'POST',
    body: input,
  })

/** The caller's whole collection — filter and sort happen client-side. */
export const listPokemon = (signal?: AbortSignal): Promise<Pokemon[]> =>
  apiRequest('/pokemon', pokemonListSchema, { signal })

/** 404 covers both unknown and not-the-caller's-own. */
export const getPokemon = (
  id: string,
  signal?: AbortSignal,
): Promise<Pokemon> => apiRequest(`/pokemon/${id}`, pokemonSchema, { signal })

export const createPokemon = (input: PokemonInput): Promise<Pokemon> =>
  apiRequest('/pokemon', pokemonSchema, { method: 'POST', body: input })

/** Re-derives server-side on a species/IV/CP change. */
export const updatePokemon = (
  id: string,
  patch: PokemonPatch,
): Promise<Pokemon> =>
  apiRequest(`/pokemon/${id}`, pokemonSchema, { method: 'PATCH', body: patch })

export const deletePokemon = (id: string): Promise<void> =>
  apiRequest(`/pokemon/${id}`, z.undefined(), { method: 'DELETE' })

// --- Catalog ---------------------------------------------------------------

export const getCatalog = (signal?: AbortSignal): Promise<CatalogStatus> =>
  apiRequest('/catalog', catalogStatusSchema, { signal })

/** Admin-only; 502 `gamedata-unavailable` when the source is down. */
export const triggerSync = (): Promise<CatalogStatus> =>
  apiRequest('/catalog/sync', catalogStatusSchema, { method: 'POST' })

// --- Auth ------------------------------------------------------------------

/** The session-bootstrap probe opts out of the global 401/403 handling to interpret it itself. */
export const me = (options: ApiRequestOptions = {}): Promise<Me> =>
  apiRequest('/auth/me', meSchema, options)

export const logout = (): Promise<void> =>
  apiRequest('/auth/logout', z.undefined(), { method: 'POST' })
