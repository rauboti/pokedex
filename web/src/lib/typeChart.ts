/**
 * Vendored Pokémon GO type-effectiveness chart — the only game constant on the web tier (constitution
 * Game Data Constraints; see the web README's "Vendored type chart").
 *
 * Source: Gen VI+ type relations as used by GO, cross-checked against GamePress
 * (https://gamepress.gg/pokemongo/type-effectiveness) and Bulbapedia's damage-type chart.
 *
 * GO has no true 0× immunity — a main-series immunity becomes 0.625² = 0.390625, "immune in effect".
 * Authored as per-attacker relation lists and expanded at module load, so no cell can be half-filled.
 */

export const SUPER_EFFECTIVE = 1.6
export const NEUTRAL = 1
export const NOT_VERY_EFFECTIVE = 0.625
export const IMMUNE = 0.390625

/** Must stay in step with `components/pokemon/pokemonTypes.ts` and the api's type names. */
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

/** The vendored source data: unlisted defenders are neutral, so Normal carries an empty `se`. */
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

export const canonicalType = (type: string): string | undefined =>
  CANONICAL.get(type.trim().toLowerCase())

/**
 * Case-insensitive. An unrecognised type on either side is {@link NEUTRAL} rather than an error, so
 * matchup display degrades gracefully on catalog data this table doesn't know.
 */
export const effectiveness = (attack: string, defend: string): number => {
  const a = canonicalType(attack)
  const d = canonicalType(defend)
  if (a === undefined || d === undefined) return NEUTRAL
  return TYPE_CHART[a][d]
}
