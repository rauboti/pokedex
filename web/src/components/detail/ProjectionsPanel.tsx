import { Box, Heading, Stack } from '@chakra-ui/react'
import { Card } from '@rauboti/ui'
import type { Projection } from '@/api/schemas'
import { projectionRows } from './projections'

/**
 * The detail-view level projections (US3, FR-009). One row per server-supplied projection — L40 and
 * L50 always, the Best-Buddy row only when a `BEST_BUDDY` projection is present (i.e. the Pokémon is
 * flagged Best Buddy). The DTO→row mapping lives in [projectionRows]; values come straight from
 * `derived.projections` — no client math (research D7). Rendered as a plain bordered table on a
 * transparent surface, using the app's `border` / `text.muted` tokens so it follows the colour mode.
 */

/** Effective stats are fractional; level/CP/HP are whole. Drop the trailing `.0`. */
const fmt = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(1))

const HEADERS = ['Target', 'Level', 'CP', 'HP', 'Atk', 'Def', 'Sta']

export const ProjectionsPanel = ({
  projections,
}: {
  projections: Projection[]
}) => {
  const rows = projectionRows(projections)
  return (
    <Card>
      <Stack as="section" aria-label="Projections" gap="4">
        <Heading size="md">Projections</Heading>
        <Box overflowX="auto">
          <Box
            as="table"
            w="full"
            borderWidth="1px"
            borderColor="border"
            rounded="md"
            borderCollapse="collapse"
            fontSize="sm"
          >
            <Box as="thead">
              <Box as="tr">
                {HEADERS.map((h) => (
                  <Box
                    as="th"
                    key={h}
                    textAlign="left"
                    px="3"
                    py="2"
                    fontSize="xs"
                    fontWeight="semibold"
                    color="text.muted"
                    borderBottomWidth="1px"
                    borderColor="border"
                  >
                    {h}
                  </Box>
                ))}
              </Box>
            </Box>
            <Box as="tbody">
              {rows.map((r) => (
                <Box
                  as="tr"
                  key={r.target}
                  borderTopWidth="1px"
                  borderColor="border"
                >
                  <Box as="td" px="3" py="2" fontWeight="medium">
                    {r.target}
                  </Box>
                  <Box as="td" px="3" py="2">
                    {r.level}
                  </Box>
                  <Box as="td" px="3" py="2">
                    {r.cp}
                  </Box>
                  <Box as="td" px="3" py="2">
                    {r.hp}
                  </Box>
                  <Box as="td" px="3" py="2">
                    {fmt(r.attack)}
                  </Box>
                  <Box as="td" px="3" py="2">
                    {fmt(r.defense)}
                  </Box>
                  <Box as="td" px="3" py="2">
                    {fmt(r.stamina)}
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      </Stack>
    </Card>
  )
}
