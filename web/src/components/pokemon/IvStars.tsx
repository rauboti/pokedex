import { Box, HStack } from '@chakra-ui/react'
import { StarIcon } from '@rauboti/ui'

/**
 * A Pokémon GO-style IV rating, mirroring the game's appraisal:
 *
 *   25–49% → 1 yellow  ·  50–74% → 2 yellow  ·  75–99% → 3 yellow  ·  100% → 4 pink
 *
 * Below 25% shows no stars. The exact percentage stays in the group's label, so screen readers and
 * hover lose nothing by the stars replacing the number.
 */

const Star = ({ tone }: { tone: 'yellow' | 'pink' }) => (
  <Box
    as="span"
    data-star={tone}
    display="inline-flex"
    color={tone === 'pink' ? 'pink.400' : 'yellow.400'}
  >
    <StarIcon size={16} fill="currentColor" />
  </Box>
)

export const IvStars = ({
  ivPercent,
  perfect,
}: {
  ivPercent: number
  perfect: boolean
}) => {
  const isPerfect = perfect || ivPercent >= 100
  // Perfect: four pink stars. Otherwise: one yellow star per 25% band (0–3).
  const count = isPerfect ? 4 : Math.min(3, Math.floor(ivPercent / 25))
  const tone = isPerfect ? 'pink' : 'yellow'
  const label = `IV ${ivPercent}%`

  return (
    <HStack as="span" gap="0.5" role="img" aria-label={label} title={label}>
      {Array.from({ length: count }, (_, i) => (
        <Star key={i} tone={tone} />
      ))}
    </HStack>
  )
}
