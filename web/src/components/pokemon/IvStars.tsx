import { Box, HStack } from '@chakra-ui/react'
import { StarIcon } from '@rauboti/ui'

/**
 * A Pokémon GO-style IV star rating — the collection card's bottom-left signal, replacing the raw
 * IV% number. Mirrors the game's appraisal: **yellow** stars scale with the IV band (one per 25%),
 * and a **perfect** catch shows the full **four pink** stars — a hundo stands out by both the extra
 * star and the colour.
 *
 *   IV 25–49% → 1 yellow   ·   50–74% → 2 yellow   ·   75–99% → 3 yellow   ·   100% → 4 pink
 *
 * Stars are the DS `StarIcon` (lucide `star`) filled via `fill="currentColor"` so they read solid.
 * `ivPercent`/`perfect` are read straight from the server-derived DTO (no client stat math, research
 * D7). The exact percentage stays available to screen readers and on hover via the group's label,
 * so nothing is lost by showing stars instead of the number. A sub-25% catch shows no stars (the
 * label still carries the value).
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
