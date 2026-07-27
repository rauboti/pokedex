import { HStack, Heading, Stack, Text } from '@chakra-ui/react'
import { Card } from '@rauboti/ui'
import type { Pokemon } from '@/api/schemas'
import { IvStars } from '@/components/pokemon/IvStars'
import { IvGauges } from '@/components/detail/IvGauges'
import { StatTable } from '@/components/detail/StatTable'

/**
 * The detail-view stats panel (US3). Shows the server-derived block straight from the DTO — no client
 * stat math (research D7): the current level/CP/HP/effective stats as a single-row [StatTable] (same
 * columns and presentation as the projections below it), the per-stat IV breakdown as gauges
 * ([IvGauges]), and the overall IV% as the star rating the list uses. The species types and catch
 * flags live in the page header, not here.
 */
export const StatsPanel = ({ pokemon }: { pokemon: Pokemon }) => {
  const { derived, ivAtk, ivDef, ivSta, cp } = pokemon
  const current = {
    target: 'Current',
    level: derived.level,
    cp,
    hp: derived.hp,
    attack: derived.attack,
    defense: derived.defense,
    stamina: derived.stamina,
  }
  return (
    <Card>
      <Stack as="section" aria-label="Stats" gap="4">
        <HStack justify="space-between" wrap="wrap" gap="2">
          <Heading size="md">Stats</Heading>
          <HStack gap="2">
            <IvStars ivPercent={derived.ivPercent} perfect={derived.perfect} />
            <Text fontSize="sm" color="text.muted">
              {derived.ivPercent}%
            </Text>
          </HStack>
        </HStack>

        <StatTable rows={[current]} />

        <IvGauges ivAtk={ivAtk} ivDef={ivDef} ivSta={ivSta} />
      </Stack>
    </Card>
  )
}
