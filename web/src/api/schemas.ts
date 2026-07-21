import { z } from 'zod'
import { apiRequest, type ApiRequestOptions } from './client'

/**
 * Typed client for the pokedex data API (contract `/api/species`, `/api/derivation`,
 * `/api/pokemon`, `/api/catalog`) plus the `/api/auth` shapes. Zod schemas validate every response
 * body; the functions wrap [apiRequest] with the right method/path so callers work in typed values,
 * never raw fetches. Shapes mirror the OpenAPI `Species` / `Move` / `SpeciesMoves` /
 * `DerivationResult` / `Derived` / `Pokemon` / `CatalogStatus` / `Me` schemas. All stat math is
 * server-side (research D7) — the `Derived` block is read, never computed here.
 */

/** A species+form from the synced catalog (`Species`). `types` is 1–2 canonical type names;
 *  `form` is null for the base form. */
export const speciesSchema = z.object({
  id: z.string(),
  dexNr: z.number(),
  name: z.string(),
  form: z.string().nullable(),
  types: z.array(z.string()).min(1).max(2),
  baseAtk: z.number(),
  baseDef: z.number(),
  baseSta: z.number(),
  syncedAt: z.string(),
})
export type Species = z.infer<typeof speciesSchema>

/** A fast/charged move (`Move`). `legacy` is present on move-pool entries (not currently
 *  obtainable by normal means — US5); absent on recorded moves. */
export const moveSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  fast: z.boolean(),
  legacy: z.boolean().optional(),
})
export type Move = z.infer<typeof moveSchema>

/** A species' move pool + the sync-computed recommendation (`SpeciesMoves`, US5/research D8).
 *  `recommended` is null when the pool is unknown. */
export const speciesMovesSchema = z.object({
  speciesId: z.string(),
  fastMoves: z.array(moveSchema),
  chargedMoves: z.array(moveSchema),
  recommended: z
    .object({ fastMoveId: z.string(), chargedMoveId: z.string() })
    .nullable(),
})
export type SpeciesMoves = z.infer<typeof speciesMovesSchema>

/** One CP→level candidate (`DerivationResult.candidates[]`); `dustCost` disambiguates a
 *  CP collision (US1 scenario 4). */
export const derivationCandidateSchema = z.object({
  level: z.number(),
  hp: z.number(),
  attack: z.number(),
  defense: z.number(),
  stamina: z.number(),
  dustCost: z.number(),
})
export type DerivationCandidate = z.infer<typeof derivationCandidateSchema>

/** `POST /api/derivation` result. An empty `candidates` array = impossible combination (SC-004). */
export const derivationResultSchema = z.object({
  candidates: z.array(derivationCandidateSchema),
})
export type DerivationResult = z.infer<typeof derivationResultSchema>

/** `POST /api/derivation` request body (`DerivationRequest`). */
export type DerivationRequest = {
  speciesId: string
  ivAtk: number
  ivDef: number
  ivSta: number
  cp: number
}

/** One projected level row (`Derived.projections[]`): L40/L50 always, Best Buddy when flagged. */
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

/** The server-computed derived block (`Derived`, research D7) — the SPA does no stat math. */
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

/** A registered Pokémon (`Pokemon`) with its nested flags, recorded moves (nulls = unrecorded),
 *  and the server-computed `derived` block. `stale` is set by the post-sync rescan (FR-013). */
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

/** `POST /api/pokemon` request body (`PokemonInput`). `level` is required only when the derivation
 *  is ambiguous and must then be one of the candidates; flags/moves/caughtAt are optional. */
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

/** `PATCH /api/pokemon/{id}` body (`PokemonPatch`) — any subset of the input fields. */
export type PokemonPatch = Partial<PokemonInput>

/** `GET /api/catalog` (`CatalogStatus`). `syncedAt` is null until the first successful sync;
 *  `stalePokemonCount` is the caller's own stale Pokémon (FR-013). */
export const catalogStatusSchema = z.object({
  speciesCount: z.number(),
  moveCount: z.number(),
  syncedAt: z.string().nullable(),
  stalePokemonCount: z.number(),
})
export type CatalogStatus = z.infer<typeof catalogStatusSchema>

/** `GET /api/auth/me` (`Me`) — the pokedex identity from hive claims. `roles` is the flat
 *  aud-scoped list; an empty list means signed in but no pokedex access (no-access screen). */
export const meSchema = z.object({
  sub: z.string(),
  name: z.string().nullable().optional(),
  roles: z.array(z.string()),
})
export type Me = z.infer<typeof meSchema>

// --- Species ---------------------------------------------------------------

/** `GET /api/species?q=` — case-insensitive name search over registrable species (mega/temporary
 *  forms excluded). `limit` caps results (server max 50). */
export const searchSpecies = (
  q: string,
  limit?: number,
  signal?: AbortSignal,
): Promise<Species[]> => {
  const query = new URLSearchParams({ q })
  if (limit !== undefined) query.set('limit', String(limit))
  return apiRequest(`/species?${query}`, z.array(speciesSchema), { signal })
}

/** `GET /api/species/{id}/moves` — the pool (legacy markers) + recommended pairing (US5). */
export const getSpeciesMoves = (
  id: string,
  signal?: AbortSignal,
): Promise<SpeciesMoves> =>
  apiRequest(`/species/${id}/moves`, speciesMovesSchema, { signal })

// --- Derivation & Pokémon --------------------------------------------------

/** `POST /api/derivation` — stateless CP→level preview; empty candidates = impossible (SC-004). */
export const derive = (input: DerivationRequest): Promise<DerivationResult> =>
  apiRequest('/derivation', derivationResultSchema, {
    method: 'POST',
    body: input,
  })

/** `GET /api/pokemon` — the caller's full collection (filter/sort happens client-side, D10). */
export const listPokemon = (signal?: AbortSignal): Promise<Pokemon[]> =>
  apiRequest('/pokemon', pokemonListSchema, { signal })

/** `POST /api/pokemon` — register a Pokémon; resolves the created resource with its derived block. */
export const createPokemon = (input: PokemonInput): Promise<Pokemon> =>
  apiRequest('/pokemon', pokemonSchema, { method: 'POST', body: input })

/** `PATCH /api/pokemon/{id}` — partial edit (re-derives on species/IV/CP change); resolves the
 *  updated Pokémon. */
export const updatePokemon = (
  id: string,
  patch: PokemonPatch,
): Promise<Pokemon> =>
  apiRequest(`/pokemon/${id}`, pokemonSchema, { method: 'PATCH', body: patch })

/** `DELETE /api/pokemon/{id}` — permanently delete (FR-010; 204 No Content). */
export const deletePokemon = (id: string): Promise<void> =>
  apiRequest(`/pokemon/${id}`, z.undefined(), { method: 'DELETE' })

// --- Catalog ---------------------------------------------------------------

/** `GET /api/catalog` — sync status for the catalog-freshness UI. */
export const getCatalog = (signal?: AbortSignal): Promise<CatalogStatus> =>
  apiRequest('/catalog', catalogStatusSchema, { signal })

/** `POST /api/catalog/sync` — trigger a game-data sync (admin-only); resolves the refreshed status.
 *  502 `gamedata-unavailable` when the source is down. */
export const triggerSync = (): Promise<CatalogStatus> =>
  apiRequest('/catalog/sync', catalogStatusSchema, { method: 'POST' })

// --- Auth ------------------------------------------------------------------

/** `GET /api/auth/me` — the session-bootstrap probe. The AuthProvider passes
 *  `redirectOnUnauthorized/notifyForbidden: false` to interpret 401/403 itself. */
export const me = (options: ApiRequestOptions = {}): Promise<Me> =>
  apiRequest('/auth/me', meSchema, options)

/** `POST /api/auth/logout` — end the session (204). */
export const logout = (): Promise<void> =>
  apiRequest('/auth/logout', z.undefined(), { method: 'POST' })
