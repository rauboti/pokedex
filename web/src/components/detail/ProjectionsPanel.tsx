import { Heading, Stack } from '@chakra-ui/react'
import { Card } from '@rauboti/ui'
import type { Projection } from '@/api/schemas'
import { projectionRows } from './projections'
import { StatTable } from './StatTable'

/**
 * The detail-view level projections (US3, FR-009). One row per server-supplied projection — L40 and
 * L50 always, the Best-Buddy row only when a `BEST_BUDDY` projection is present (i.e. the Pokémon is
 * flagged Best Buddy). Shares the [StatTable] presentation with the current stats; the DTO→row mapping
 * lives in [projectionRows]. Values come straight from `derived.projections` — no client math (D7).
 */
export const ProjectionsPanel = ({
  projections,
}: {
  projections: Projection[]
}) => (
  <Card>
    <Stack as="section" aria-label="Projections" gap="4">
      <Heading size="md">Projections</Heading>
      <StatTable rows={projectionRows(projections)} />
    </Stack>
  </Card>
)
