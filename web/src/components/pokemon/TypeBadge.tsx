import { Image, Text } from '@chakra-ui/react'
import { TYPE_ICONS } from './pokemonTypes'

/**
 * The type's colored icon. Its name is both `alt` and `title`, so screen readers announce it and
 * sighted users get a hover label without a tooltip component. An unknown type degrades to text.
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
