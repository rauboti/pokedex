import { http, HttpResponse, type RequestHandler } from 'msw'
import type {
  Derived,
  Move,
  Pokemon,
  PokemonInput,
  PokemonPatch,
} from '@/api/schemas'
import {
  authenticatedUser,
  catalogStatus,
  derivationCandidatesFor,
  pokemon,
  species,
  speciesById,
  speciesMovesById,
} from './fixtures'

/**
 * Default mock request handlers, shared by the test server (`server.ts`) and the dev worker
 * (`browser.ts`). Defaults represent a signed-in player with pokedex access so the app renders
 * without a real hive; individual tests override per-case with `server.use(...)` (e.g. a 401 for
 * the unauthenticated path, a 403 for the no-access path, or a specific derivation/pokemon shape).
 *
 * The pokemon CRUD handlers back the dev worker with an in-memory store so register/edit/delete
 * behave end-to-end in mock mode. Tests never rely on this state — page tests supply their own
 * per-case handlers — so cross-test contamination isn't a concern (`server.resetHandlers()`
 * restores this default list after each test).
 */

/** A `problem+json` response with the stable machine `code`. */
const problem = (status: number, title: string, code: string) =>
  HttpResponse.json(
    { title, status, code },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  )

/** Resolve a move id to a full Move from the seeded pools, else a minimal stub (mock only). */
const findMove = (id: string, fast: boolean): Move => {
  for (const pool of Object.values(speciesMovesById)) {
    const hit = [...pool.fastMoves, ...pool.chargedMoves].find(
      (m) => m.id === id,
    )
    if (hit) return hit
  }
  return { id, name: id, type: 'Normal', fast }
}

/** A hand-authored derived block for a mock create/edit (the api computes the real one, D7). */
const derivedFor = (input: PokemonInput | Required<PokemonPatch>): Derived => {
  const ivPercent =
    Math.round(((input.ivAtk + input.ivDef + input.ivSta) / 45) * 1000) / 10
  const perfect = input.ivAtk === 15 && input.ivDef === 15 && input.ivSta === 15
  return {
    level: input.level ?? 20,
    hp: 120,
    attack: 130.5,
    defense: 120.4,
    stamina: 150,
    ivPercent,
    perfect,
    projections: [
      {
        label: 'L40',
        level: 40,
        cp: 3000,
        hp: 150,
        attack: 180,
        defense: 170,
        stamina: 175,
      },
      {
        label: 'L50',
        level: 50,
        cp: 3400,
        hp: 165,
        attack: 195,
        defense: 185,
        stamina: 190,
      },
      ...(input.bestBuddy
        ? [
            {
              label: 'BEST_BUDDY' as const,
              level: 21,
              cp: 2200,
              hp: 125,
              attack: 135,
              defense: 125,
              stamina: 155,
            },
          ]
        : []),
    ],
  }
}

const makePokemonHandlers = (): RequestHandler[] => {
  // A mutable copy so dev-mode writes persist across a session without touching the fixtures.
  let store: Pokemon[] = [...pokemon]
  let nextId = 1

  const build = (id: string, input: PokemonInput): Pokemon => ({
    id,
    species: speciesById(input.speciesId) ?? species[0],
    ivAtk: input.ivAtk,
    ivDef: input.ivDef,
    ivSta: input.ivSta,
    cp: input.cp,
    flags: {
      shiny: input.shiny ?? false,
      shadow: input.shadow ?? false,
      lucky: input.lucky ?? false,
      purified: input.purified ?? false,
      bestBuddy: input.bestBuddy ?? false,
    },
    moves: {
      fast: input.fastMoveId ? findMove(input.fastMoveId, true) : null,
      charged1: input.chargedMove1Id
        ? findMove(input.chargedMove1Id, false)
        : null,
      charged2: input.chargedMove2Id
        ? findMove(input.chargedMove2Id, false)
        : null,
    },
    derived: derivedFor(input),
    stale: false,
    caughtAt: input.caughtAt ?? null,
    createdAt: '2026-07-21T12:00:00Z',
  })

  return [
    http.get('/api/pokemon', () => HttpResponse.json(store)),
    http.post('/api/pokemon', async ({ request }) => {
      const input = (await request.json()) as PokemonInput
      const created = build(`mock-${nextId++}`, input)
      store = [created, ...store]
      return HttpResponse.json(created, { status: 201 })
    }),
    http.patch('/api/pokemon/:id', async ({ params, request }) => {
      const { id } = params as { id: string }
      const existing = store.find((p) => p.id === id)
      if (!existing) return new HttpResponse(null, { status: 404 })
      const patch = (await request.json()) as PokemonPatch
      const merged: PokemonInput = {
        speciesId: patch.speciesId ?? existing.species.id,
        ivAtk: patch.ivAtk ?? existing.ivAtk,
        ivDef: patch.ivDef ?? existing.ivDef,
        ivSta: patch.ivSta ?? existing.ivSta,
        cp: patch.cp ?? existing.cp,
        level: patch.level ?? existing.derived.level,
        shiny: patch.shiny ?? existing.flags.shiny,
        shadow: patch.shadow ?? existing.flags.shadow,
        lucky: patch.lucky ?? existing.flags.lucky,
        purified: patch.purified ?? existing.flags.purified,
        bestBuddy: patch.bestBuddy ?? existing.flags.bestBuddy,
        fastMoveId: patch.fastMoveId ?? existing.moves.fast?.id ?? null,
        chargedMove1Id:
          patch.chargedMove1Id ?? existing.moves.charged1?.id ?? null,
        chargedMove2Id:
          patch.chargedMove2Id ?? existing.moves.charged2?.id ?? null,
        caughtAt: patch.caughtAt ?? existing.caughtAt,
      }
      const updated: Pokemon = {
        ...build(id, merged),
        createdAt: existing.createdAt,
      }
      store = store.map((p) => (p.id === id ? updated : p))
      return HttpResponse.json(updated)
    }),
    http.delete('/api/pokemon/:id', ({ params }) => {
      const { id } = params as { id: string }
      store = store.filter((p) => p.id !== id)
      return new HttpResponse(null, { status: 204 })
    }),
  ]
}

export const handlers: RequestHandler[] = [
  // Auth
  http.get('/api/auth/me', () => HttpResponse.json(authenticatedUser)),
  http.post('/api/auth/logout', () => new HttpResponse(null, { status: 204 })),

  // Catalog
  http.get('/api/catalog', () => HttpResponse.json(catalogStatus)),
  http.post('/api/catalog/sync', () => HttpResponse.json(catalogStatus)),

  // Species search + move pool
  http.get('/api/species', ({ request }) => {
    const url = new URL(request.url)
    const q = (url.searchParams.get('q') ?? '').toLowerCase()
    const limit = Number(url.searchParams.get('limit') ?? '20')
    const matches = species
      .filter((s) => s.name.toLowerCase().includes(q))
      .slice(0, limit)
    return HttpResponse.json(matches)
  }),
  http.get('/api/species/:id/moves', ({ params }) => {
    const { id } = params as { id: string }
    const moves = speciesMovesById[id]
    if (!moves) return problem(404, 'Not Found', 'unknown-species')
    return HttpResponse.json(moves)
  }),

  // Derivation preview — 1 / 2 / 0 candidates by fixture CP (US1 scenario 4, SC-004)
  http.post('/api/derivation', async ({ request }) => {
    const body = (await request.json()) as { speciesId: string; cp: number }
    if (!speciesById(body.speciesId)) {
      return problem(404, 'Not Found', 'unknown-species')
    }
    return HttpResponse.json({ candidates: derivationCandidatesFor(body.cp) })
  }),

  // Pokémon CRUD (in-memory store)
  ...makePokemonHandlers(),
]
