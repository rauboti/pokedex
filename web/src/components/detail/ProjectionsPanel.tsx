import { Heading, Stack } from '@chakra-ui/react'
import { Card } from '@rauboti/ui'
import type { Projection } from '@/api/schemas'
import { projectionRows } from './projections'
import { StatTable } from './StatTable'

/**
 * One row per server-supplied projection — L40 and L50 always, Best Buddy only when the api sends that
 * projection. Shares [StatTable] with the current stats.
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
