import { useState } from 'react'
import { Image } from '@chakra-ui/react'
import type { ImageProps } from '@chakra-ui/react'
import type { Pokemon } from '@/api/schemas'

/**
 * Prefers the shiny artwork when the Pokémon is shiny and a shiny URL exists. Renders nothing when
 * there is no synced image or it fails to load — the card's name already identifies it.
 */
export const PokemonSprite = ({
  pokemon,
  size = '16',
}: {
  pokemon: Pokemon
  /** Chakra `boxSize` (default `'16'`); accepts a responsive value to grow on wider screens. */
  size?: ImageProps['boxSize']
}) => {
  const [failed, setFailed] = useState(false)
  const { species, flags } = pokemon
  const url =
    (flags.shiny && species.shinyImageUrl) || species.imageUrl || undefined

  if (!url || failed) return null

  const label = species.form
    ? `${species.name} (${species.form})`
    : species.name

  return (
    <Image
      src={url}
      alt={label}
      boxSize={size}
      flexShrink="0"
      objectFit="contain"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}
