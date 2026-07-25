import { Image, Text } from '@chakra-ui/react'
import { TYPE_ICONS } from './pokemonTypes'

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
