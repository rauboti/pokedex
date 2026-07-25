import bug from '@/assets/types/bug.svg'
import dark from '@/assets/types/dark.svg'
import dragon from '@/assets/types/dragon.svg'
import electric from '@/assets/types/electric.svg'
import fairy from '@/assets/types/fairy.svg'
import fighting from '@/assets/types/fighting.svg'
import fire from '@/assets/types/fire.svg'
import flying from '@/assets/types/flying.svg'
import ghost from '@/assets/types/ghost.svg'
import grass from '@/assets/types/grass.svg'
import ground from '@/assets/types/ground.svg'
import ice from '@/assets/types/ice.svg'
import normal from '@/assets/types/normal.svg'
import poison from '@/assets/types/poison.svg'
import psychic from '@/assets/types/psychic.svg'
import rock from '@/assets/types/rock.svg'
import steel from '@/assets/types/steel.svg'
import water from '@/assets/types/water.svg'

/**
 * Canonical Pokémon type data, single-sourced so the badge icons (TypeBadge) and the type filter
 * (PokemonFilters) can never drift. Kept out of the component file so it can export non-components
 * (react-refresh).
 */

/**
 * Canonical type name → its vendored colored badge SVG (partywhale/pokemon-type-icons, MIT — see
 * `src/assets/types/LICENSE`). Keys match the API's canonical type names (`POKEMON_TYPE_GRASS` →
 * `"Grass"`), so a `Species.types` entry indexes directly.
 */
export const TYPE_ICONS: Record<string, string> = {
  Bug: bug,
  Dark: dark,
  Dragon: dragon,
  Electric: electric,
  Fairy: fairy,
  Fighting: fighting,
  Fire: fire,
  Flying: flying,
  Ghost: ghost,
  Grass: grass,
  Ground: ground,
  Ice: ice,
  Normal: normal,
  Poison: poison,
  Psychic: psychic,
  Rock: rock,
  Steel: steel,
  Water: water,
}

/** The 18 canonical Pokémon type names (alphabetical) — the catalog carries only these. */
export const POKEMON_TYPES = Object.keys(TYPE_ICONS)
