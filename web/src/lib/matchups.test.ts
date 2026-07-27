import { describe, expect, it } from 'vitest'
import { defensiveMatchups, offensiveCoverage, type Matchup } from './matchups'

/**
 * SC-006 gate (part 2 of 2 — dual-type stacking, buckets and offensive coverage; the raw 18×18
 * cells are pinned in `typeChart.test.ts`). Combined multipliers stack the per-type cells, so a
 * dual-type defender can reach 2.56 (double weak) or 0.390625 (double resist / immune-in-effect).
 * Fixtures use real species type pairs so the values are independently checkable against community
 * chart tools (GamePress / Pokébattler).
 */

// --- Helpers ----------------------------------------------------------------

/** type -> label, for terse assertions on a matchup group. */
const labels = (list: Matchup[]): Record<string, string> =>
  Object.fromEntries(list.map((m) => [m.type, m.label]))

/** type -> multiplier. */
const mults = (list: Matchup[]): Record<string, number> =>
  Object.fromEntries(list.map((m) => [m.type, m.multiplier]))

// --- Single-type defender ---------------------------------------------------

describe('defensiveMatchups — single type', () => {
  const water = defensiveMatchups(['Water'])

  it('splits weaknesses from resistances, dropping neutral matchups', () => {
    expect(labels(water.weaknesses)).toEqual({
      Grass: 'weak',
      Electric: 'weak',
    })
    expect(labels(water.resistances)).toEqual({
      Fire: 'resist',
      Water: 'resist',
      Ice: 'resist',
      Steel: 'resist',
    })
  })

  it('carries the exact GO multiplier on each entry', () => {
    expect(mults(water.weaknesses).Grass).toBe(1.6)
    expect(mults(water.resistances).Fire).toBe(0.625)
  })

  it('labels a true immunity as immune-in-effect (0.390625)', () => {
    const flying = defensiveMatchups(['Flying'])
    expect(labels(flying.resistances).Ground).toBe('immune-in-effect')
    expect(mults(flying.resistances).Ground).toBe(0.390625)

    const ghost = defensiveMatchups(['Ghost'])
    expect(labels(ghost.resistances).Normal).toBe('immune-in-effect')
    expect(labels(ghost.resistances).Fighting).toBe('immune-in-effect')
  })
})

// --- Dual-type stacking -----------------------------------------------------

describe('defensiveMatchups — dual-type stacking', () => {
  it('stacks two super-effective cells into a double weakness (Charizard = Fire/Flying)', () => {
    const charizard = defensiveMatchups(['Fire', 'Flying'])
    // Rock is super-effective vs both Fire and Flying -> 1.6 * 1.6.
    expect(mults(charizard.weaknesses).Rock).toBe(2.56)
    expect(labels(charizard.weaknesses).Rock).toBe('double-weak')
    // Water/Electric hit only one half -> ordinary single weakness.
    expect(labels(charizard.weaknesses).Water).toBe('weak')
    expect(labels(charizard.weaknesses).Electric).toBe('weak')
  })

  it("a weakness cancelled by the partner type's immunity nets a plain resist (Swampert = Water/Ground)", () => {
    const swampert = defensiveMatchups(['Water', 'Ground'])
    // Grass is super-effective vs both -> classic 4x.
    expect(mults(swampert.weaknesses).Grass).toBe(2.56)
    // Electric: super-effective vs Water (1.6) but immune vs Ground (0.390625) -> 0.625 net resist,
    // NOT immune-in-effect — the immunity is spent cancelling the weakness.
    expect(mults(swampert.resistances).Electric).toBe(0.625)
    expect(labels(swampert.resistances).Electric).toBe('resist')
    // Electric must not appear as a weakness.
    expect(swampert.weaknesses.some((m) => m.type === 'Electric')).toBe(false)
  })

  it('stacks two resist cells into a double resist (Ludicolo = Water/Grass)', () => {
    const ludicolo = defensiveMatchups(['Water', 'Grass'])
    // Water attack is not-very-effective vs both Water and Grass -> 0.625 * 0.625.
    expect(mults(ludicolo.resistances).Water).toBe(0.390625)
    expect(labels(ludicolo.resistances).Water).toBe('double-resist')
  })

  it('orders weaknesses strongest-first and resistances strongest-first', () => {
    const swampert = defensiveMatchups(['Water', 'Ground'])
    // Grass (2.56) precedes any single weakness.
    expect(swampert.weaknesses[0].type).toBe('Grass')
    // Resistances sorted ascending by multiplier (most-resisted first).
    const resistMults = swampert.resistances.map((m) => m.multiplier)
    expect([...resistMults]).toEqual([...resistMults].sort((a, b) => a - b))
  })
})

// --- Robustness -------------------------------------------------------------

describe('defensiveMatchups — input handling', () => {
  it('is case-insensitive and order-independent', () => {
    expect(defensiveMatchups(['fire', 'flying'])).toEqual(
      defensiveMatchups(['Flying', 'Fire']),
    )
  })

  it('ignores an unknown type rather than throwing', () => {
    expect(() => defensiveMatchups(['Water', 'Mystery'])).not.toThrow()
    expect(defensiveMatchups(['Water', 'Mystery'])).toEqual(
      defensiveMatchups(['Water']),
    )
  })
})

// --- Offensive coverage -----------------------------------------------------

describe('offensiveCoverage', () => {
  it('lists super-effective targets for each of the species STAB types', () => {
    const { stab, moves } = offensiveCoverage(['Fire'])
    expect(stab).toHaveLength(1)
    expect(stab[0].type).toBe('Fire')
    expect(stab[0].superEffective).toEqual(['Bug', 'Grass', 'Ice', 'Steel'])
    expect(moves).toEqual([])
  })

  it('covers both types of a dual-type species', () => {
    const { stab } = offensiveCoverage(['Water', 'Ground'])
    expect(stab.map((c) => c.type)).toEqual(['Water', 'Ground'])
  })

  it('reports recorded move-type coverage separately from STAB', () => {
    const { stab, moves } = offensiveCoverage(['Fire'], ['Ground', 'Fire'])
    // STAB unchanged.
    expect(stab.map((c) => c.type)).toEqual(['Fire'])
    // Ground is genuinely new coverage; the Fire move dupes STAB and is dropped.
    expect(moves.map((c) => c.type)).toEqual(['Ground'])
    expect(moves[0].superEffective).toEqual([
      'Electric',
      'Fire',
      'Poison',
      'Rock',
      'Steel',
    ])
  })

  it('is case-insensitive and ignores unknown types', () => {
    const { stab } = offensiveCoverage(['fire', 'nonsense'])
    expect(stab.map((c) => c.type)).toEqual(['Fire'])
  })
})
