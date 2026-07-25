import { describe, expect, it } from 'vitest'
import type { Pokemon, Species } from '@/api/schemas'
import { filterPokemon } from './filterPokemon'

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
  derived: {
    level: 25,
    hp: 150,
    attack: 160,
    defense: 150,
    stamina: 150,
    ivPercent: 100,
    perfect: true,
    projections: [],
  },
  stale: false,
  caughtAt: '2026-07-10',
  createdAt: '2026-07-10T18:00:00Z',
  ...over,
})

// --- Species substring -----------------------------------------------------

describe('species substring', () => {
  const venusaur = mk({ species: species({ name: 'Venusaur' }) })
  const charmander = mk({
    species: species({ id: 'CHARMANDER', name: 'Charmander', types: ['Fire'] }),
  })
  const list = [venusaur, charmander]

  it('matches a case-insensitive substring of the species name', () => {
    expect(filterPokemon(list, { species: 'char' })).toEqual([charmander])
    expect(filterPokemon(list, { species: 'AUR' })).toEqual([venusaur])
  })

  it('imposes no constraint for an empty or whitespace query', () => {
    expect(filterPokemon(list, { species: '' })).toEqual(list)
    expect(filterPokemon(list, { species: '   ' })).toEqual(list)
  })
})

// --- Type membership (incl. dual-types) ------------------------------------

describe('type membership', () => {
  const venusaur = mk({ species: species({ types: ['Grass', 'Poison'] }) })
  const charmander = mk({
    species: species({ id: 'CHARMANDER', name: 'Charmander', types: ['Fire'] }),
  })
  const list = [venusaur, charmander]

  it('matches the primary type', () => {
    expect(filterPokemon(list, { type: 'Grass' })).toEqual([venusaur])
  })

  it('matches the secondary type of a dual-typed species', () => {
    expect(filterPokemon(list, { type: 'Poison' })).toEqual([venusaur])
  })

  it('matches case-insensitively and excludes non-members', () => {
    expect(filterPokemon(list, { type: 'fire' })).toEqual([charmander])
    expect(filterPokemon(list, { type: 'Water' })).toEqual([])
  })

  it('imposes no constraint for an empty type', () => {
    expect(filterPokemon(list, { type: '' })).toEqual(list)
  })
})

// --- Flag predicates -------------------------------------------------------

describe('flag predicates', () => {
  const flags = ['shiny', 'shadow', 'lucky', 'purified', 'bestBuddy'] as const

  it.each(flags)('filters on the %s flag', (flag) => {
    const on = mk({
      flags: {
        shiny: false,
        shadow: false,
        lucky: false,
        purified: false,
        bestBuddy: false,
        [flag]: true,
      },
    })
    const off = mk()
    expect(filterPokemon([on, off], { flags: [flag] })).toEqual([on])
  })

  it('requires every listed flag (AND)', () => {
    const both = mk({
      flags: {
        shiny: true,
        shadow: false,
        lucky: true,
        purified: false,
        bestBuddy: false,
      },
    })
    const shinyOnly = mk({
      flags: {
        shiny: true,
        shadow: false,
        lucky: false,
        purified: false,
        bestBuddy: false,
      },
    })
    expect(
      filterPokemon([both, shinyOnly], { flags: ['shiny', 'lucky'] }),
    ).toEqual([both])
  })

  it('imposes no constraint for an empty flag list', () => {
    const list = [mk(), mk()]
    expect(filterPokemon(list, { flags: [] })).toEqual(list)
  })
})

// --- Stale predicate -------------------------------------------------------

describe('stale predicate', () => {
  const stale = mk({ stale: true })
  const fresh = mk({ stale: false })

  it('keeps only stale rows when stale:true', () => {
    expect(filterPokemon([stale, fresh], { stale: true })).toEqual([stale])
  })

  it('keeps only fresh rows when stale:false', () => {
    expect(filterPokemon([stale, fresh], { stale: false })).toEqual([fresh])
  })
})

// --- Composability ---------------------------------------------------------

describe('composability', () => {
  const base = {
    species: species({ name: 'Venusaur', types: ['Grass', 'Poison'] }),
    flags: {
      shiny: true,
      shadow: false,
      lucky: false,
      purified: false,
      bestBuddy: false,
    },
    stale: true,
  }
  const target = mk(base)
  const wrongName = mk({
    ...base,
    species: species({ name: 'Charmander', types: ['Grass', 'Poison'] }),
  })
  const wrongType = mk({
    ...base,
    species: species({ name: 'Venusaur', types: ['Fire'] }),
  })
  const wrongFlag = mk({
    ...base,
    flags: {
      shiny: false,
      shadow: false,
      lucky: false,
      purified: false,
      bestBuddy: false,
    },
  })
  const wrongStale = mk({ ...base, stale: false })

  it('composes every criterion with AND — one mismatched dimension excludes a row', () => {
    const list = [target, wrongName, wrongType, wrongFlag, wrongStale]
    expect(
      filterPokemon(list, {
        species: 'venu',
        type: 'Grass',
        flags: ['shiny'],
        stale: true,
      }),
    ).toEqual([target])
  })

  it('returns a new array (never mutates) and passes everything through with no criteria', () => {
    const list = [mk(), mk()]
    const result = filterPokemon(list, {})
    expect(result).toEqual(list)
    expect(result).not.toBe(list)
  })
})
