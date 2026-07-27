import {
  IMMUNE,
  NEUTRAL,
  POKEMON_TYPES,
  SUPER_EFFECTIVE,
  TYPE_CHART,
  canonicalType,
  effectiveness,
} from './typeChart'

/**
 * Pure type-matchup helpers for the detail view. Both functions work off `Species.types` and the
 * vendored {@link TYPE_CHART} alone — no server round-trip, no stat math.
 *
 * `defensiveMatchups` stacks the per-type cells for a 1–2 type defender (a dual type multiplies its
 * two cells, so effectiveness can reach 2.56 or 0.390625). `offensiveCoverage` reports which
 * defenders the species hits super-effectively, split into STAB (the species' own types) and any
 * recorded move types (US5 scenario 5 groundwork, kept distinct from STAB).
 */

/**
 * How an attacking type fares against a defender, bucketed for display:
 * - `double-weak` 2.56 — both defender types are weak to it
 * - `weak` 1.6 — single weakness
 * - `resist` 0.625 — single resistance (net)
 * - `double-resist` 0.390625 — two stacked resistances (no immunity involved)
 * - `immune-in-effect` — a true (main-series) immunity is in play and un-cancelled; GO renders this
 *   as ≤0.390625 heavy resistance rather than 0×
 */
export type MatchupLabel =
  'double-weak' | 'weak' | 'resist' | 'double-resist' | 'immune-in-effect'

/** One attacking type's combined effectiveness against a defender's full type set. */
export interface Matchup {
  /** The attacking type. */
  type: string
  /** Exact stacked GO multiplier (product of the per-defender-type cells). */
  multiplier: number
  /** Display bucket derived from {@link multiplier} and immunity provenance. */
  label: MatchupLabel
}

/** A defender's weaknesses and resistances, each sorted strongest-first. */
export interface DefensiveMatchups {
  /** Multiplier > 1, ordered by descending multiplier (double weaknesses first). */
  weaknesses: Matchup[]
  /** Multiplier < 1, ordered by ascending multiplier (most-resisted first). */
  resistances: Matchup[]
}

/** Two stacked super-effective cells (1.6²), pre-rounded so it compares cleanly against {@link stack}. */
const DOUBLE_WEAK = 2.56

/** Product of at most two GO multipliers, rounded to kill IEEE-754 noise (1.6×1.6 would otherwise
 *  be 2.5600000000000005). 12 dp is exact for every reachable value down to 0.390625² = 0.152587890625. */
const stack = (cells: number[]): number =>
  Math.round(cells.reduce((acc, c) => acc * c, 1) * 1e12) / 1e12

/** Bucket a stacked multiplier, using the participating cells to tell a live immunity apart from a
 *  plain double-resist (both are 0.390625). */
const labelFor = (multiplier: number, cells: number[]): MatchupLabel => {
  if (multiplier >= DOUBLE_WEAK) return 'double-weak'
  if (multiplier > NEUTRAL) return 'weak'
  // Resistance side (multiplier < 1). An un-cancelled immunity (no super-effective cell to spend it
  // against) reads as immune-in-effect; otherwise it's an ordinary or double resistance.
  const hasImmune = cells.includes(IMMUNE)
  const hasSuperEffective = cells.includes(SUPER_EFFECTIVE)
  if (hasImmune && !hasSuperEffective) return 'immune-in-effect'
  return multiplier <= IMMUNE ? 'double-resist' : 'resist'
}

/** Canonicalise a 1–2 type list, dropping unknowns and duplicates (order preserved). */
const cleanTypes = (types: string[]): string[] => {
  const out: string[] = []
  for (const t of types) {
    const c = canonicalType(t)
    if (c !== undefined && !out.includes(c)) out.push(c)
  }
  return out
}

/**
 * Defensive weaknesses and resistances for a species with the given `types` (1–2 canonical type
 * names, any casing/order). Neutral matchups are omitted. An empty/all-unknown input yields empty
 * groups.
 */
export const defensiveMatchups = (types: string[]): DefensiveMatchups => {
  const defTypes = cleanTypes(types)
  const weaknesses: Matchup[] = []
  const resistances: Matchup[] = []

  for (const attack of POKEMON_TYPES) {
    const cells = defTypes.map((dt) => TYPE_CHART[attack][dt])
    if (cells.length === 0) continue
    const multiplier = stack(cells)
    if (multiplier === NEUTRAL) continue
    const entry: Matchup = {
      type: attack,
      multiplier,
      label: labelFor(multiplier, cells),
    }
    ;(multiplier > NEUTRAL ? weaknesses : resistances).push(entry)
  }

  weaknesses.sort((a, b) => b.multiplier - a.multiplier)
  resistances.sort((a, b) => a.multiplier - b.multiplier)
  return { weaknesses, resistances }
}

/** The defending types an attacking `type` is super-effective against (alphabetical). */
export interface TypeCoverage {
  /** The attacking type. */
  type: string
  /** Single defending types this attack hits for 1.6× (super effective), sorted alphabetically. */
  superEffective: string[]
}

/** Offensive coverage split into innate (STAB) and recorded-move contributions. */
export interface OffensiveCoverage {
  /** Coverage from the species' own type(s) — the STAB perspective. */
  stab: TypeCoverage[]
  /** Coverage from recorded move types not already among the species types (empty when none). */
  moves: TypeCoverage[]
}

const coverageOf = (type: string): TypeCoverage => ({
  type,
  superEffective: POKEMON_TYPES.filter(
    (d) => effectiveness(type, d) === SUPER_EFFECTIVE,
  ).sort(),
})

/**
 * Super-effective coverage for a species. `stab` covers each of the species' own `types`; `moves`
 * covers each recorded `moveTypes` entry that isn't already a species type (so it reads as genuinely
 * *additional* coverage, kept distinct from STAB). Unknown/duplicate types are dropped; casing is
 * ignored.
 */
export const offensiveCoverage = (
  types: string[],
  moveTypes: string[] = [],
): OffensiveCoverage => {
  const stabTypes = cleanTypes(types)
  const moveOnly = cleanTypes(moveTypes).filter((t) => !stabTypes.includes(t))
  return {
    stab: stabTypes.map(coverageOf),
    moves: moveOnly.map(coverageOf),
  }
}
