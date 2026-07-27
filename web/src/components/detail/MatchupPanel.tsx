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
 * The detail-view type matchups (US4, FR-015 — SC-006's UI half). Computed entirely client-side from
 * the species' types + the vendored chart (research D6.3): defensive weaknesses/resistances via
 * [defensiveMatchups] (dual-type stacking, so a matchup can be double) and offensive "strong against"
 * coverage via [offensiveCoverage]. Each defensive matchup shows its stacked multiplier, which is
 * what visually distinguishes a double weakness (2.56×) from a single one (1.6×). `moveTypes` is the
 * US5 groundwork: when recorded move types are supplied, their extra coverage renders as its own
 * section, kept distinct from the innate STAB coverage.
 */

/** Multiplier → badge severity: weaknesses warm (worse = more severe), resistances cool (stronger
 *  = more positive). */
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

/** A titled row of matchup chips, with an explicit empty state so "no resistances" never reads as
 *  a rendering bug. */
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

/** A titled row of plain type badges (offensive coverage — super-effective is binary, no multiplier),
 *  with the same explicit empty state. */
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

/** Union of the super-effective targets across a set of coverage entries, sorted alphabetically. */
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
