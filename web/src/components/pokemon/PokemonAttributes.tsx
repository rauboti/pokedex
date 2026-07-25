import { Box, HStack } from '@chakra-ui/react'
import {
  BubblesIcon,
  FlameIcon,
  HeartIcon,
  SparklesIcon,
  SunIcon,
  VenetianMaskIcon,
  WandIcon,
} from '@rauboti/ui'
import type { ReactNode } from 'react'
import type { Pokemon } from '@/api/schemas'

/**
 * A collection card's status row: small coloured glyphs for what a Pokémon *is* and what it *carries*
 * — the species rarity (Legendary, Mythic) first, then the catch attributes (Shiny, Shadow, Purified,
 * Lucky, Best Buddy) — each shown only when present. The row keeps a **fixed height** whether or not
 * any glyph is present, so every card is the same height regardless of attributes.
 *
 * Glyphs are `@rauboti/ui` icons (the DS's lucide-based set), coloured via the wrapper
 * (`currentColor`) — ui-first, no hand-rolled SVG here. Rarity comes from the synced `Species.rarity`
 * (Game Master `pokemonClass`, normalized api-side) — never hardcoded on the web (constitution). An
 * unmapped rarity (e.g. "Ultra Beast") simply shows no glyph.
 */

/** Species rarity glyphs, keyed by the synced `Species.rarity` label. Rendered before catch
 *  attributes; a rarity not in this map (e.g. "Ultra Beast") shows nothing. */
const RARITIES: Record<
  string,
  { label: string; color: string; glyph: ReactNode }
> = {
  Legendary: {
    label: 'Legendary',
    color: 'purple.800',
    glyph: <VenetianMaskIcon size={18} />,
  },
  Mythic: { label: 'Mythic', color: 'pink.500', glyph: <WandIcon size={18} /> },
}

type FlagKey = 'shiny' | 'shadow' | 'purified' | 'lucky' | 'bestBuddy'
const ATTRIBUTES: {
  key: FlagKey
  label: string
  color: string
  glyph: ReactNode
}[] = [
  {
    key: 'shiny',
    label: 'Shiny',
    color: 'yellow.400',
    glyph: <SparklesIcon size={18} />,
  },
  {
    key: 'shadow',
    label: 'Shadow',
    color: 'purple.400',
    glyph: <FlameIcon size={18} />,
  },
  {
    key: 'purified',
    label: 'Purified',
    color: 'cyan.400',
    glyph: <SunIcon size={18} />,
  },
  {
    key: 'lucky',
    label: 'Lucky',
    color: 'orange.400',
    glyph: <BubblesIcon size={18} />,
  },
  {
    key: 'bestBuddy',
    label: 'Best Buddy',
    color: 'pink.400',
    glyph: <HeartIcon size={18} />,
  },
]

const Glyph = ({
  label,
  color,
  children,
}: {
  label: string
  color: string
  children: ReactNode
}) => (
  <Box
    color={color}
    role="img"
    aria-label={label}
    title={label}
    display="inline-flex"
  >
    {children}
  </Box>
)

export const PokemonAttributes = ({
  flags,
  rarity,
}: {
  flags: Pokemon['flags']
  rarity?: string | null
}) => {
  const rarityEntry = rarity ? RARITIES[rarity] : undefined
  return (
    <HStack gap="2" minH="6" justify="center" wrap="wrap">
      {rarityEntry && (
        <Glyph label={rarityEntry.label} color={rarityEntry.color}>
          {rarityEntry.glyph}
        </Glyph>
      )}
      {ATTRIBUTES.filter(({ key }) => flags[key]).map(
        ({ key, label, color, glyph }) => (
          <Glyph key={key} label={label} color={color}>
            {glyph}
          </Glyph>
        ),
      )}
    </HStack>
  )
}
