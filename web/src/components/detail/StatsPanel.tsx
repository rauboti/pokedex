import { Box, HStack, Heading, SimpleGrid, Stack, Text } from '@chakra-ui/react'
import { Card } from '@rauboti/ui'
import type { Pokemon } from '@/api/schemas'
import { IvStars } from '@/components/pokemon/IvStars'
import { IvGauges } from '@/components/detail/IvGauges'

/**
 * The detail-view stats panel (US3). Shows the server-derived block straight from the DTO — no client
 * stat math (research D7): level, CP, HP, effective attack/defense/stamina, and the per-stat IV
 * breakdown as gauges ([IvGauges]) with the overall IV% as the star rating the list uses. The species
 * types and catch flags live in the page header, not here.
 */

/** Effective stats are fractional; level/CP/HP are whole. Drop the trailing `.0`. */
const fmt = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(1))

const Stat = ({ label, value }: { label: string; value: string | number }) => (
  <Box>
    <Text fontSize="xs" color="text.muted">
      {label}
    </Text>
    <Text fontWeight="medium">{value}</Text>
  </Box>
)

export const StatsPanel = ({ pokemon }: { pokemon: Pokemon }) => {
  const { derived, ivAtk, ivDef, ivSta, cp } = pokemon
  return (
    <Card>
      <Stack as="section" aria-label="Stats" gap="4">
        <HStack justify="space-between" wrap="wrap" gap="2">
          <Heading size="md">Stats</Heading>
          <HStack gap="2">
            <IvStars ivPercent={derived.ivPercent} perfect={derived.perfect} />
            <Text fontSize="sm" color="text.muted">
              {fmt(derived.ivPercent)}%
            </Text>
          </HStack>
        </HStack>

        <SimpleGrid columns={3} gap="3">
          <Stat label="Level" value={derived.level} />
          <Stat label="CP" value={cp} />
          <Stat label="HP" value={derived.hp} />
          <Stat label="Attack" value={fmt(derived.attack)} />
          <Stat label="Defense" value={fmt(derived.defense)} />
          <Stat label="Stamina" value={fmt(derived.stamina)} />
        </SimpleGrid>

        <Box>
          <Text fontSize="xs" color="text.muted" mb="2">
            IVs (Attack / Defense / Stamina)
          </Text>
          <IvGauges ivAtk={ivAtk} ivDef={ivDef} ivSta={ivSta} />
        </Box>
      </Stack>
    </Card>
  )
}
