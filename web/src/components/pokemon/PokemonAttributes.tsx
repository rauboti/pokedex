import { Box, HStack } from '@chakra-ui/react'
import type { ReactNode, SVGProps } from 'react'
import type { Pokemon } from '@/api/schemas'

/**
 * A collection card's status row: small coloured glyphs for what a Pokémon *is* and what it *carries*
 * — the species rarity (Legendary, Mythic) first, then the catch attributes (Shiny, Shadow, Purified,
 * Lucky, Best Buddy) — each shown only when present. The row keeps a **fixed height** whether or not
 * any glyph is present, so every card is the same height regardless of attributes.
 *
 * Glyphs are lucide path data (ISC-licensed), coloured via the wrapper (`currentColor`). Rarity comes
 * from the synced `Species.rarity` (Game Master `pokemonClass`, normalized api-side) — never hardcoded
 * on the web (constitution). An unmapped rarity (e.g. "Ultra Beast") simply shows no glyph.
 */

const glyph: SVGProps<SVGSVGElement> = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

const ShinyGlyph = () => (
  <svg {...glyph}>
    <path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" />
    <path d="M20 2v4" />
    <path d="M22 4h-4" />
    <circle cx="4" cy="20" r="2" />
  </svg>
)

const ShadowGlyph = () => (
  <svg {...glyph}>
    <path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4" />
  </svg>
)

const LuckyGlyph = () => (
  <svg {...glyph}>
    <path d="M7.001 15.085A1.5 1.5 0 0 1 9 16.5" />
    <circle cx="18.5" cy="8.5" r="3.5" />
    <circle cx="7.5" cy="16.5" r="5.5" />
    <circle cx="7.5" cy="4.5" r="2.5" />
  </svg>
)

const BestBuddyGlyph = () => (
  <svg {...glyph}>
    <path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" />
  </svg>
)

const PurifiedGlyph = () => (
  <svg {...glyph}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2" />
    <path d="M12 20v2" />
    <path d="m4.93 4.93 1.41 1.41" />
    <path d="m17.66 17.66 1.41 1.41" />
    <path d="M2 12h2" />
    <path d="M20 12h2" />
    <path d="m6.34 17.66-1.41 1.41" />
    <path d="m19.07 4.93-1.41 1.41" />
  </svg>
)

const LegendaryGlyph = () => (
  <svg {...glyph}>
    <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
    <path d="M5 21h14" />
  </svg>
)

const MythicGlyph = () => (
  <svg {...glyph}>
    <path d="M10.5 3 8 9l4 13 4-13-2.5-6" />
    <path d="M17 3a2 2 0 0 1 1.6.8l3 4a2 2 0 0 1 .013 2.382l-7.99 10.986a2 2 0 0 1-3.247 0l-7.99-10.986A2 2 0 0 1 2.4 7.8l2.998-3.997A2 2 0 0 1 7 3z" />
    <path d="M2 9h20" />
  </svg>
)

/** Species rarity glyphs, keyed by the synced `Species.rarity` label. Rendered before catch
 *  attributes; a rarity not in this map (e.g. "Ultra Beast") shows nothing. */
const RARITIES: Record<
  string,
  { label: string; color: string; glyph: ReactNode }
> = {
  Legendary: {
    label: 'Legendary',
    color: 'purple.800',
    glyph: <LegendaryGlyph />,
  },
  Mythic: { label: 'Mythic', color: 'pink.500', glyph: <MythicGlyph /> },
}

type FlagKey = 'shiny' | 'shadow' | 'purified' | 'lucky' | 'bestBuddy'
const ATTRIBUTES: {
  key: FlagKey
  label: string
  color: string
  glyph: ReactNode
}[] = [
  { key: 'shiny', label: 'Shiny', color: 'yellow.400', glyph: <ShinyGlyph /> },
  {
    key: 'shadow',
    label: 'Shadow',
    color: 'purple.400',
    glyph: <ShadowGlyph />,
  },
  {
    key: 'purified',
    label: 'Purified',
    color: 'cyan.400',
    glyph: <PurifiedGlyph />,
  },
  { key: 'lucky', label: 'Lucky', color: 'orange.400', glyph: <LuckyGlyph /> },
  {
    key: 'bestBuddy',
    label: 'Best Buddy',
    color: 'pink.400',
    glyph: <BestBuddyGlyph />,
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
