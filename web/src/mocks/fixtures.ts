import type {
  CatalogStatus,
  DerivationCandidate,
  Me,
  Pokemon,
  Species,
  SpeciesMoves,
} from '@/api/schemas'

/**
 * Shared sample data for MSW handlers (dev worker + test server) and for tests that need a
 * realistic payload. Shapes mirror the OpenAPI contract (`Me`, `Species`, `SpeciesMoves`,
 * `Pokemon`, `CatalogStatus`). Values are illustrative — the api owns the real catalog + all stat
 * math (research D7); here the `derived` block is hand-authored, not computed.
 */

const SYNCED_AT = '2026-07-21T09:00:00Z'

/** The signed-in player returned by `GET /api/auth/me` in mock mode (holds the `user` role). */
export const authenticatedUser: Me = {
  sub: '10000000-0000-4000-8000-000000000001',
  name: 'Ada Lovelace',
  roles: ['user'],
}

/**
 * Sample registrable species (`GET /api/species`). Deliberately covers the shapes later features
 * lean on: a dual-type (Venusaur, Grass/Poison), a regional form (Alolan Rattata, Dark/Normal), a
 * double-weakness combo (Golem, Rock/Ground — 2× Water/Grass, groundwork for the matchup view,
 * T026), and a single-type (Charmander, Fire).
 */
export const species: Species[] = [
  {
    id: 'VENUSAUR',
    dexNr: 3,
    name: 'Venusaur',
    form: null,
    types: ['Grass', 'Poison'],
    baseAtk: 198,
    baseDef: 189,
    baseSta: 190,
    syncedAt: SYNCED_AT,
  },
  {
    id: 'CHARMANDER',
    dexNr: 4,
    name: 'Charmander',
    form: null,
    types: ['Fire'],
    baseAtk: 116,
    baseDef: 93,
    baseSta: 118,
    syncedAt: SYNCED_AT,
  },
  {
    id: 'RATTATA_ALOLA',
    dexNr: 19,
    name: 'Rattata',
    form: 'Alola',
    types: ['Dark', 'Normal'],
    baseAtk: 103,
    baseDef: 70,
    baseSta: 102,
    syncedAt: SYNCED_AT,
  },
  {
    id: 'GOLEM',
    dexNr: 76,
    name: 'Golem',
    form: null,
    types: ['Rock', 'Ground'],
    baseAtk: 211,
    baseDef: 198,
    baseSta: 190,
    syncedAt: SYNCED_AT,
  },
]

/** Look up a seeded species fixture by id. */
export const speciesById = (id: string): Species | undefined =>
  species.find((s) => s.id === id)

/**
 * A species' move pool (`GET /api/species/{id}/moves`) — Venusaur, with a legacy Elite-TM charged
 * move (Frenzy Plant) and the sync-computed recommendation (US5/research D8).
 */
export const venusaurMoves: SpeciesMoves = {
  speciesId: 'VENUSAUR',
  fastMoves: [
    { id: 'VINE_WHIP_FAST', name: 'Vine Whip', type: 'Grass', fast: true },
    { id: 'RAZOR_LEAF_FAST', name: 'Razor Leaf', type: 'Grass', fast: true },
  ],
  chargedMoves: [
    { id: 'SLUDGE_BOMB', name: 'Sludge Bomb', type: 'Poison', fast: false },
    { id: 'POWER_WHIP', name: 'Power Whip', type: 'Grass', fast: false },
    {
      id: 'FRENZY_PLANT',
      name: 'Frenzy Plant',
      type: 'Grass',
      fast: false,
      legacy: true,
    },
  ],
  recommended: { fastMoveId: 'VINE_WHIP_FAST', chargedMoveId: 'FRENZY_PLANT' },
}

/** Move pools keyed by species id, for the `/api/species/{id}/moves` handler. */
export const speciesMovesById: Record<string, SpeciesMoves> = {
  VENUSAUR: venusaurMoves,
}

/**
 * Derivation CP sentinels for the mock `POST /api/derivation` handler, so tests can exercise the
 * three outcomes deterministically: a unique match (default), a CP collision (two candidates that
 * differ by dust cost, US1 scenario 4), and an impossible combination (empty — SC-004).
 */
export const COLLISION_CP = 500
export const IMPOSSIBLE_CP = 13

const candidate = (level: number, dustCost: number): DerivationCandidate => ({
  level,
  hp: 120,
  attack: 130.5,
  defense: 120.4,
  stamina: 150,
  dustCost,
})

/** The candidate list the mock returns for a given requested CP. */
export const derivationCandidatesFor = (cp: number): DerivationCandidate[] => {
  if (cp === IMPOSSIBLE_CP) return []
  if (cp === COLLISION_CP) return [candidate(18, 3000), candidate(20, 3500)]
  return [candidate(20, 3500)]
}

/** Catalog status in mock mode — a populated, freshly-synced catalog with no stale Pokémon. */
export const catalogStatus: CatalogStatus = {
  speciesCount: species.length,
  moveCount: 11,
  syncedAt: SYNCED_AT,
  stalePokemonCount: 0,
}

const perfectDerived = {
  level: 25,
  hp: 151,
  attack: 168.2,
  defense: 160.7,
  stamina: 161.4,
  ivPercent: 100,
  perfect: true,
  projections: [
    {
      label: 'L40' as const,
      level: 40,
      cp: 3097,
      hp: 190,
      attack: 210.1,
      defense: 200.9,
      stamina: 201.7,
    },
    {
      label: 'L50' as const,
      level: 50,
      cp: 3494,
      hp: 202,
      attack: 223.4,
      defense: 213.6,
      stamina: 214.5,
    },
  ],
}

/**
 * Sample collection (`GET /api/pokemon`) — one hundo Venusaur with recorded moves, so the dev
 * worker renders a non-empty list. Tests supply their own per-case handlers rather than leaning on
 * this seed.
 */
export const pokemon: Pokemon[] = [
  {
    id: 'aaaaaaaa-0000-4000-8000-000000000001',
    species: species[0],
    ivAtk: 15,
    ivDef: 15,
    ivSta: 15,
    cp: 2087,
    flags: {
      shiny: false,
      shadow: false,
      lucky: false,
      purified: false,
      bestBuddy: false,
    },
    moves: {
      fast: {
        id: 'VINE_WHIP_FAST',
        name: 'Vine Whip',
        type: 'Grass',
        fast: true,
      },
      charged1: {
        id: 'FRENZY_PLANT',
        name: 'Frenzy Plant',
        type: 'Grass',
        fast: false,
        legacy: true,
      },
      charged2: null,
    },
    derived: perfectDerived,
    stale: false,
    caughtAt: '2026-07-10',
    createdAt: '2026-07-10T18:00:00Z',
  },
]
