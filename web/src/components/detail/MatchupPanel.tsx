import { HStack, Heading, Stack, Text } from '@chakra-ui/react'
import { Badge, type BadgeType, Card } from '@rauboti/ui'
import {
  defensiveMatchups,
  offensiveCoverage,
  type Matchup,
  type MatchupLabel,
} from '@/lib/matchups'
import { TypeBadge } from '@/components/pokemon/TypeBadge'

/**
 * Type matchups, computed entirely client-side from the species' types plus the vendored chart. The
 * stacked multiplier on each chip is what distinguishes a double weakness (2.56×) from a single one
 * (1.6×). Recorded `moveTypes` render as their own section, kept distinct from innate STAB coverage.
 */

/** Weaknesses run warm, resistances cool. */
const TIER_BADGE: Record<MatchupLabel, BadgeType> = {
  'double-weak': 'danger',
  weak: 'warning',
  resist: 'info',
  'double-resist': 'success',
  'immune-in-effect': 'success',
}

/** Compact GO multiplier label, e.g. 2.56 → "2.56×", 1.6 → "1.6×", 0.390625 → "0.39×". */
const formatMultiplier = (m: number): string => `${parseFloat(m.toFixed(2))}×`

const MatchupChip = ({ matchup }: { matchup: Matchup }) => (
  <HStack gap="1.5">
    <TypeBadge type={matchup.type} />
    <Badge type={TIER_BADGE[matchup.label]}>
      {formatMultiplier(matchup.multiplier)}
    </Badge>
  </HStack>
)

/** The explicit empty state matters: "no resistances" must not read as a rendering bug. */
const MatchupGroup = ({
  label,
  matchups,
}: {
  label: string
  matchups: Matchup[]
}) => (
  <Stack as="section" aria-label={label} gap="2">
    <Text fontSize="sm" fontWeight="semibold" color="text.muted">
      {label}
    </Text>
    {matchups.length === 0 ? (
      <Text fontSize="sm" color="text.muted">
        None
      </Text>
    ) : (
      <HStack gap="2" wrap="wrap">
        {matchups.map((m) => (
          <MatchupChip key={m.type} matchup={m} />
        ))}
      </HStack>
    )}
  </Stack>
)

/** Offensive coverage is binary, so no multiplier is shown. */
const CoverageGroup = ({
  label,
  types,
}: {
  label: string
  types: string[]
}) => (
  <Stack as="section" aria-label={label} gap="2">
    <Text fontSize="sm" fontWeight="semibold" color="text.muted">
      {label}
    </Text>
    {types.length === 0 ? (
      <Text fontSize="sm" color="text.muted">
        None
      </Text>
    ) : (
      <HStack gap="2" wrap="wrap">
        {types.map((t) => (
          <TypeBadge key={t} type={t} />
        ))}
      </HStack>
    )}
  </Stack>
)

const coverageTargets = (entries: { superEffective: string[] }[]): string[] =>
  [...new Set(entries.flatMap((e) => e.superEffective))].sort()

export const MatchupPanel = ({
  types,
  moveTypes,
}: {
  types: string[]
  moveTypes?: string[]
}) => {
  const { weaknesses, resistances } = defensiveMatchups(types)
  const { stab, moves } = offensiveCoverage(types, moveTypes)

  return (
    <Card>
      <Stack as="section" aria-label="Type matchups" gap="5">
        <Heading size="md">Type matchups</Heading>
        <MatchupGroup label="Weaknesses" matchups={weaknesses} />
        <MatchupGroup label="Resistances" matchups={resistances} />
        <CoverageGroup label="Strong against" types={coverageTargets(stab)} />
        {moves.length > 0 && (
          <CoverageGroup label="Move coverage" types={coverageTargets(moves)} />
        )}
      </Stack>
    </Card>
  )
}
