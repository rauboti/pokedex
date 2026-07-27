/**
 * Vendored Pokémon GO type-effectiveness chart (research D6.3, constitution Game Data Constraints:
 * stable reference tables are vendored, never fetched). This is the *only* game constant that lives
 * on the web tier — the matchup view is computed entirely client-side from `Species.types` plus
 * this table, so the api ships no type-effectiveness endpoint.
 *
 * Source of truth: the Gen VI+ type relations as used by Pokémon GO, mapped onto GO's four
 * multipliers. Cross-checked against GamePress ("Type Effectiveness",
 * https://gamepress.gg/pokemongo/type-effectiveness) and Bulbapedia's damage-type chart.
 *
 * GO has no true 0× immunity: a main-series immunity becomes "double not very effective"
 * (0.625² = 0.390625) — heavy resistance, "immune in effect". The four multipliers are therefore:
 *   super effective        1.6
 *   neutral                1
 *   not very effective     0.625
 *   immune (in effect)     0.390625
 *
 * The chart is authored as readable per-attacker relation lists and expanded into the full 18×18
 * numeric matrix at module load — auditable by eye, and impossible to leave a cell half-filled.
 * `matchups.ts` stacks these cells for dual-type defenders.
 */

export const SUPER_EFFECTIVE = 1.6
export const NEUTRAL = 1
export const NOT_VERY_EFFECTIVE = 0.625
export const IMMUNE = 0.390625

/** The 18 canonical type names (matches `components/pokemon/pokemonTypes.ts` and the api's names). */
export const POKEMON_TYPES = [
  'Normal',
  'Fire',
  'Water',
  'Electric',
  'Grass',
  'Ice',
  'Fighting',
  'Poison',
  'Ground',
  'Flying',
  'Psychic',
  'Bug',
  'Rock',
  'Ghost',
  'Dragon',
  'Dark',
  'Steel',
  'Fairy',
] as const

export type PokemonType = (typeof POKEMON_TYPES)[number]

/**
 * Per-attacking-type relations (the vendored source data). `se` / `nve` / `immune` list the
 * defending types an attack of that type is super-effective / not-very-effective / immune against;
 * every unlisted defender is neutral. Attackers with no super-effective targets (Normal) simply
 * carry an empty `se`.
 */
const RELATIONS: Record<
  PokemonType,
  { se: PokemonType[]; nve: PokemonType[]; immune: PokemonType[] }
> = {
  Normal: { se: [], nve: ['Rock', 'Steel'], immune: ['Ghost'] },
  Fire: {
    se: ['Grass', 'Ice', 'Bug', 'Steel'],
    nve: ['Fire', 'Water', 'Rock', 'Dragon'],
    immune: [],
  },
  Water: {
    se: ['Fire', 'Ground', 'Rock'],
    nve: ['Water', 'Grass', 'Dragon'],
    immune: [],
  },
  Electric: {
    se: ['Water', 'Flying'],
    nve: ['Electric', 'Grass', 'Dragon'],
    immune: ['Ground'],
  },
  Grass: {
    se: ['Water', 'Ground', 'Rock'],
    nve: ['Fire', 'Grass', 'Poison', 'Flying', 'Bug', 'Dragon', 'Steel'],
    immune: [],
  },
  Ice: {
    se: ['Grass', 'Ground', 'Flying', 'Dragon'],
    nve: ['Fire', 'Water', 'Ice', 'Steel'],
    immune: [],
  },
  Fighting: {
    se: ['Normal', 'Ice', 'Rock', 'Dark', 'Steel'],
    nve: ['Poison', 'Flying', 'Psychic', 'Bug', 'Fairy'],
    immune: ['Ghost'],
  },
  Poison: {
    se: ['Grass', 'Fairy'],
    nve: ['Poison', 'Ground', 'Rock', 'Ghost'],
    immune: ['Steel'],
  },
  Ground: {
    se: ['Fire', 'Electric', 'Poison', 'Rock', 'Steel'],
    nve: ['Grass', 'Bug'],
    immune: ['Flying'],
  },
  Flying: {
    se: ['Grass', 'Fighting', 'Bug'],
    nve: ['Electric', 'Rock', 'Steel'],
    immune: [],
  },
  Psychic: {
    se: ['Fighting', 'Poison'],
    nve: ['Psychic', 'Steel'],
    immune: ['Dark'],
  },
  Bug: {
    se: ['Grass', 'Psychic', 'Dark'],
    nve: ['Fire', 'Fighting', 'Poison', 'Flying', 'Ghost', 'Steel', 'Fairy'],
    immune: [],
  },
  Rock: {
    se: ['Fire', 'Ice', 'Flying', 'Bug'],
    nve: ['Fighting', 'Ground', 'Steel'],
    immune: [],
  },
  Ghost: { se: ['Psychic', 'Ghost'], nve: ['Dark'], immune: ['Normal'] },
  Dragon: { se: ['Dragon'], nve: ['Steel'], immune: ['Fairy'] },
  Dark: {
    se: ['Psychic', 'Ghost'],
    nve: ['Fighting', 'Dark', 'Fairy'],
    immune: [],
  },
  Steel: {
    se: ['Ice', 'Rock', 'Fairy'],
    nve: ['Fire', 'Water', 'Electric', 'Steel'],
    immune: [],
  },
  Fairy: {
    se: ['Fighting', 'Dragon', 'Dark'],
    nve: ['Fire', 'Poison', 'Steel'],
    immune: [],
  },
}

/** Full 18×18 numeric matrix: `TYPE_CHART[attack][defend]` is one of the four GO multipliers. */
export const TYPE_CHART: Record<
  string,
  Record<string, number>
> = Object.fromEntries(
  POKEMON_TYPES.map((attack) => {
    const { se, nve, immune } = RELATIONS[attack]
    const row: Record<string, number> = {}
    for (const defend of POKEMON_TYPES) {
      row[defend] = se.includes(defend)
        ? SUPER_EFFECTIVE
        : nve.includes(defend)
          ? NOT_VERY_EFFECTIVE
          : immune.includes(defend)
            ? IMMUNE
            : NEUTRAL
    }
    return [attack, row]
  }),
)

const CANONICAL = new Map(
  POKEMON_TYPES.map((t) => [t.toLowerCase(), t as string]),
)

/** Canonical casing for a type name, or `undefined` if it is not one of the 18 types. */
export const canonicalType = (type: string): string | undefined =>
  CANONICAL.get(type.trim().toLowerCase())

/**
 * Effectiveness multiplier of an `attack` type against a single `defend` type. Case-insensitive;
 * an unknown type on either side is treated as {@link NEUTRAL} (the lib never throws on catalog
 * data it doesn't recognise — matchup display degrades gracefully).
 */
export const effectiveness = (attack: string, defend: string): number => {
  const a = canonicalType(attack)
  const d = canonicalType(defend)
  if (a === undefined || d === undefined) return NEUTRAL
  return TYPE_CHART[a][d]
}
