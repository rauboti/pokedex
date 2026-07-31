import { HStack, Heading, Stack, Text } from '@chakra-ui/react'
import { Card } from '@rauboti/ui'
import type { Pokemon } from '@/api/schemas'
import { IvStars } from '@/components/pokemon/IvStars'
import { IvGauges } from '@/components/detail/IvGauges'
import { StatTable } from '@/components/detail/StatTable'

/**
 * The server-derived stats block: current stats as a single-row [StatTable], the per-stat IV gauges,
 * and the overall IV% as the same star rating the list uses. Types and flags live in the page header.
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
