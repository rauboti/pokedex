import { describe, expect, it } from 'vitest'
import type { Derived, Pokemon, Species } from '@/api/schemas'
import { sortPokemon } from './sortPokemon'

// --- Fixtures --------------------------------------------------------------

const species = (over: Partial<Species> = {}): Species => ({
  id: 'VENUSAUR',
  dexNr: 3,
  name: 'Venusaur',
  form: null,
  types: ['Grass', 'Poison'],
  baseAtk: 198,
  baseDef: 189,
  baseSta: 190,
  syncedAt: '2026-07-21T09:00:00Z',
  ...over,
})

const derived = (over: Partial<Derived> = {}): Derived => ({
  level: 25,
  hp: 150,
  attack: 160,
  defense: 150,
  stamina: 150,
  ivPercent: 100,
  perfect: true,
  projections: [],
  ...over,
})

let seq = 0
const mk = (over: Partial<Pokemon> = {}): Pokemon => ({
  id: `p${seq++}`,
  species: species(),
  ivAtk: 15,
  ivDef: 15,
  ivSta: 15,
  cp: 2000,
  flags: {
    shiny: false,
    shadow: false,
    lucky: false,
    purified: false,
    bestBuddy: false,
  },
  moves: { fast: null, charged1: null, charged2: null },
  derived: derived(),
  stale: false,
  caughtAt: '2026-07-10',
  createdAt: '2026-07-10T18:00:00Z',
  ...over,
})

const ids = (list: Pokemon[]) => list.map((p) => p.id)

// --- Numeric keys ----------------------------------------------------------

describe('numeric keys', () => {
  it('sorts by IV% ascending and descending', () => {
    const lo = mk({ id: 'lo', derived: derived({ ivPercent: 40 }) })
    const hi = mk({ id: 'hi', derived: derived({ ivPercent: 100 }) })
    expect(
      ids(sortPokemon([hi, lo], { key: 'ivPercent', direction: 'asc' })),
    ).toEqual(['lo', 'hi'])
    expect(
      ids(sortPokemon([lo, hi], { key: 'ivPercent', direction: 'desc' })),
    ).toEqual(['hi', 'lo'])
  })

  it('sorts by CP', () => {
    const a = mk({ id: 'a', cp: 500 })
    const b = mk({ id: 'b', cp: 3000 })
    expect(ids(sortPokemon([a, b], { key: 'cp', direction: 'desc' }))).toEqual([
      'b',
      'a',
    ])
  })

  it('sorts by level', () => {
    const a = mk({ id: 'a', derived: derived({ level: 15 }) })
    const b = mk({ id: 'b', derived: derived({ level: 40 }) })
    expect(
      ids(sortPokemon([b, a], { key: 'level', direction: 'asc' })),
    ).toEqual(['a', 'b'])
  })
})

// --- Caught date (nulls last) ----------------------------------------------

describe('caught date', () => {
  const old = mk({ id: 'old', caughtAt: '2020-01-01' })
  const recent = mk({ id: 'recent', caughtAt: '2026-07-01' })
  const never = mk({ id: 'never', caughtAt: null })

  it('sorts chronologically with nulls last, ascending', () => {
    expect(
      ids(
        sortPokemon([never, recent, old], {
          key: 'caughtAt',
          direction: 'asc',
        }),
      ),
    ).toEqual(['old', 'recent', 'never'])
  })

  it('keeps nulls last even when descending', () => {
    expect(
      ids(
        sortPokemon([never, old, recent], {
          key: 'caughtAt',
          direction: 'desc',
        }),
      ),
    ).toEqual(['recent', 'old', 'never'])
  })
})

// --- Species name (form tiebreak) ------------------------------------------

describe('species name', () => {
  it('sorts by name, breaking ties on form so the base form precedes its variants', () => {
    const rattataBase = mk({
      id: 'base',
      species: species({ id: 'RATTATA', name: 'Rattata', form: null }),
    })
    const rattataAlola = mk({
      id: 'alola',
      species: species({ id: 'RATTATA_ALOLA', name: 'Rattata', form: 'Alola' }),
    })
    const bulbasaur = mk({
      id: 'bulba',
      species: species({ id: 'BULBASAUR', name: 'Bulbasaur' }),
    })
    expect(
      ids(
        sortPokemon([rattataAlola, rattataBase, bulbasaur], {
          key: 'name',
          direction: 'asc',
        }),
      ),
    ).toEqual(['bulba', 'base', 'alola'])
  })
})

// --- Stability & purity ----------------------------------------------------

describe('stability & purity', () => {
  it('is stable — rows equal on the key keep their input order in both directions', () => {
    const a = mk({ id: 'a', cp: 1000 })
    const b = mk({ id: 'b', cp: 1000 })
    const c = mk({ id: 'c', cp: 1000 })
    expect(
      ids(sortPokemon([a, b, c], { key: 'cp', direction: 'asc' })),
    ).toEqual(['a', 'b', 'c'])
    expect(
      ids(sortPokemon([c, b, a], { key: 'cp', direction: 'desc' })),
    ).toEqual(['c', 'b', 'a'])
  })

  it('returns a new array and does not mutate the input', () => {
    const list = [mk({ id: 'x', cp: 2 }), mk({ id: 'y', cp: 1 })]
    const snapshot = [...list]
    const result = sortPokemon(list, { key: 'cp', direction: 'asc' })
    expect(result).not.toBe(list)
    expect(list).toEqual(snapshot)
  })
})
