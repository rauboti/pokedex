import { Image, Text } from '@chakra-ui/react'
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
 * Canonical type name → its vendored colored badge SVG (partywhale/pokemon-type-icons, MIT — see
 * `src/assets/types/LICENSE`). Keys match the API's canonical type names (`POKEMON_TYPE_GRASS` →
 * `"Grass"`), so a `Species.types` entry indexes directly.
 */
const TYPE_ICONS: Record<string, string> = {
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

/**
 * A Pokémon type badge: just the type's colored icon (colour baked into the SVG). The type name is
 * the image's accessible name (`alt`) — announced by screen readers — and its native `title`, so
 * sighted users get a hover label without a separate tooltip component. An unknown type (shouldn't
 * occur; the catalog carries only the 18) degrades to a text label.
 */
export const TypeBadge = ({ type }: { type: string }) => {
  const icon = TYPE_ICONS[type]
  if (!icon) {
    return (
      <Text fontSize="xs" fontWeight="medium" color="text.muted">
        {type}
      </Text>
    )
  }
  return <Image src={icon} alt={type} title={type} boxSize="6" flexShrink="0" />
}
