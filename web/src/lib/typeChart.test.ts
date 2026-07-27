import { describe, expect, it } from 'vitest'
import {
  IMMUNE,
  NEUTRAL,
  NOT_VERY_EFFECTIVE,
  POKEMON_TYPES,
  SUPER_EFFECTIVE,
  TYPE_CHART,
  effectiveness,
} from './typeChart'

/**
 * SC-006 gate (part 1 of 2 — the raw chart; the combined/dual-type half lives in `matchups.test.ts`).
 *
 * The expected values below are pinned against the canonical Pokémon GO type-effectiveness chart
 * (Gen VI+ relations; GO's four multipliers 1.6 / 1 / 0.625 / 0.390625). Source of truth:
 * GamePress "Type Effectiveness" chart (https://gamepress.gg/pokemongo/type-effectiveness) and
 * Bulbapedia's type chart. Any discrepancy here is a real defect, not a test to relax.
 */

// --- Multiplier constants ---------------------------------------------------

describe('GO multipliers', () => {
  it('uses the four Pokémon GO effectiveness values', () => {
    expect(SUPER_EFFECTIVE).toBe(1.6)
    expect(NEUTRAL).toBe(1)
    expect(NOT_VERY_EFFECTIVE).toBe(0.625)
    // GO has no true 0×: former immunities are "double not very effective" (0.625²).
    expect(IMMUNE).toBe(0.390625)
    expect(IMMUNE).toBeCloseTo(NOT_VERY_EFFECTIVE * NOT_VERY_EFFECTIVE, 12)
  })
})

// --- Structural invariants (18×18, every cell a legal multiplier) -----------

describe('chart shape', () => {
  it('lists the 18 canonical types', () => {
    expect(POKEMON_TYPES).toHaveLength(18)
    expect(new Set(POKEMON_TYPES).size).toBe(18)
  })

  it('is a complete 18×18 matrix with only legal multipliers', () => {
    const legal = new Set([
      SUPER_EFFECTIVE,
      NEUTRAL,
      NOT_VERY_EFFECTIVE,
      IMMUNE,
    ])
    for (const attack of POKEMON_TYPES) {
      const row = TYPE_CHART[attack]
      expect(row, `missing row for ${attack}`).toBeDefined()
      expect(Object.keys(row)).toHaveLength(18)
      for (const defend of POKEMON_TYPES) {
        const m = row[defend]
        expect(
          legal.has(m),
          `${attack}->${defend} = ${m} is not a legal GO multiplier`,
        ).toBe(true)
      }
    }
  })

  it('defaults an unlisted relation to neutral', () => {
    // Normal attacking Water is an ordinary (neutral) hit.
    expect(effectiveness('Normal', 'Water')).toBe(NEUTRAL)
  })

  it('is case-insensitive on both operands', () => {
    expect(effectiveness('fire', 'grass')).toBe(SUPER_EFFECTIVE)
    expect(effectiveness('FIRE', 'GRASS')).toBe(SUPER_EFFECTIVE)
  })
})

// --- The three GO immunities (all 18 attackers covered across the suite) ----

describe('immunities (immune-in-effect, 0.390625)', () => {
  it.each([
    ['Normal', 'Ghost'],
    ['Fighting', 'Ghost'],
    ['Ghost', 'Normal'],
    ['Ground', 'Flying'],
    ['Electric', 'Ground'],
    ['Poison', 'Steel'],
    ['Psychic', 'Dark'],
    ['Dragon', 'Fairy'],
  ])('%s does near-nothing to %s', (attack, defend) => {
    expect(effectiveness(attack, defend)).toBe(IMMUNE)
  })
})

// --- Super-effective spot-checks: at least one per attacking type -----------

describe('super effective (1.6) — every attacking type', () => {
  it.each([
    ['Normal', 'Fighting', NEUTRAL], // Normal has no super-effective target — a neutral control
    ['Fire', 'Grass', SUPER_EFFECTIVE],
    ['Water', 'Fire', SUPER_EFFECTIVE],
    ['Electric', 'Water', SUPER_EFFECTIVE],
    ['Grass', 'Water', SUPER_EFFECTIVE],
    ['Ice', 'Dragon', SUPER_EFFECTIVE],
    ['Fighting', 'Normal', SUPER_EFFECTIVE],
    ['Poison', 'Fairy', SUPER_EFFECTIVE],
    ['Ground', 'Electric', SUPER_EFFECTIVE],
    ['Flying', 'Fighting', SUPER_EFFECTIVE],
    ['Psychic', 'Poison', SUPER_EFFECTIVE],
    ['Bug', 'Psychic', SUPER_EFFECTIVE],
    ['Rock', 'Flying', SUPER_EFFECTIVE],
    ['Ghost', 'Ghost', SUPER_EFFECTIVE],
    ['Dragon', 'Dragon', SUPER_EFFECTIVE],
    ['Dark', 'Psychic', SUPER_EFFECTIVE],
    ['Steel', 'Fairy', SUPER_EFFECTIVE],
    ['Fairy', 'Dragon', SUPER_EFFECTIVE],
  ])('%s vs %s', (attack, defend, expected) => {
    expect(effectiveness(attack, defend)).toBe(expected)
  })
})

// --- Not-very-effective spot-checks -----------------------------------------

describe('not very effective (0.625)', () => {
  it.each([
    ['Fire', 'Water'],
    ['Water', 'Grass'],
    ['Grass', 'Fire'],
    ['Fighting', 'Psychic'],
    ['Bug', 'Fairy'],
    ['Dark', 'Fairy'],
    ['Dragon', 'Steel'],
    ['Ghost', 'Dark'],
    ['Steel', 'Water'],
    ['Fairy', 'Poison'],
  ])('%s resisted by %s', (attack, defend) => {
    expect(effectiveness(attack, defend)).toBe(NOT_VERY_EFFECTIVE)
  })
})

// --- SC-006 sample gate: 18 attackers × a fixed defender set ----------------

describe('SC-006 sample gate — 18 attackers × {Water, Steel, Flying, Ghost, Dragon}', () => {
  // Each row is one attacking type; columns are the expected multipliers vs the five
  // sample defenders, in order. Verified cell-by-cell against the source above.
  const SAMPLE_DEFENDERS = [
    'Water',
    'Steel',
    'Flying',
    'Ghost',
    'Dragon',
  ] as const
  const S = SUPER_EFFECTIVE
  const N = NEUTRAL
  const R = NOT_VERY_EFFECTIVE
  const I = IMMUNE

  const EXPECTED: Record<string, number[]> = {
    //           Water Steel Flying Ghost Dragon
    Normal: /**/ [N, R, N, I, N],
    Fire: /*  */ [R, S, N, N, R],
    Water: /* */ [R, N, N, N, R],
    Electric: /**/ [S, N, S, N, R],
    Grass: /* */ [S, R, R, N, R],
    Ice: /*   */ [R, R, S, N, S],
    Fighting: /**/ [N, S, R, I, N],
    Poison: /**/ [N, I, N, R, N],
    Ground: /**/ [N, S, I, N, N],
    Flying: /**/ [N, R, N, N, N],
    Psychic: /**/ [N, R, N, N, N],
    Bug: /*   */ [N, R, R, R, N],
    Rock: /*  */ [N, R, S, N, N],
    Ghost: /* */ [N, N, N, S, N],
    Dragon: /**/ [N, R, N, N, S],
    Dark: /*  */ [N, N, N, S, N],
    Steel: /* */ [R, R, N, N, N],
    Fairy: /* */ [N, R, N, N, S],
  }

  for (const attack of Object.keys(EXPECTED)) {
    it(`${attack} vs the sample set matches the chart`, () => {
      const actual = SAMPLE_DEFENDERS.map((d) => effectiveness(attack, d))
      expect(actual).toEqual(EXPECTED[attack])
    })
  }
})
