import { useState } from 'react'
import { Image } from '@chakra-ui/react'
import type { Pokemon } from '@/api/schemas'

/**
 * The species sprite for a collection card (synced URL from the catalog, research D5). Uses the shiny
 * artwork when the caught Pokémon is shiny and a shiny URL exists, else the normal image. Renders
 * nothing when the species has no synced image (many forms/megas) or the image fails to load — the
 * card's name text still identifies it, so the sprite is purely additive.
 */
export const PokemonSprite = ({
  pokemon,
  size = '16',
}: {
  pokemon: Pokemon
  size?: string
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
