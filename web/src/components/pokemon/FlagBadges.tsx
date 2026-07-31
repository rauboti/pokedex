import { HStack } from '@chakra-ui/react'
import { Badge } from '@rauboti/ui'
import type { Pokemon } from '@/api/schemas'

/** Active catch flags in a fixed order, so badges read consistently row to row. */
const FLAG_LABELS: [keyof Pokemon['flags'], string][] = [
  ['shiny', 'Shiny'],
  ['shadow', 'Shadow'],
  ['lucky', 'Lucky'],
  ['purified', 'Purified'],
  ['bestBuddy', 'Best Buddy'],
]

export const FlagBadges = ({ flags }: { flags: Pokemon['flags'] }) => {
  const active = FLAG_LABELS.filter(([key]) => flags[key])
  if (active.length === 0) return null
  return (
    <HStack gap="1" wrap="wrap">
      {active.map(([key, label]) => (
        <Badge key={key} type="info">
          {label}
        </Badge>
      ))}
    </HStack>
  )
}
