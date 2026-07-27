import { useEffect, useMemo, useState } from 'react'
import { HStack, Heading, Stack, Text } from '@chakra-ui/react'
import { Badge, Button, Callout, Card, Combobox } from '@rauboti/ui'
import {
  getSpeciesMoves,
  updatePokemon,
  type Move,
  type Pokemon,
  type SpeciesMoves,
} from '@/api/schemas'

/**
 * The detail-view moves panel. Loads the species' move pool (`GET /api/species/{id}/moves`) and
 * lets the player record a fast + up to two charged moves, chosen only from that pool
 * (legacy/Elite-TM entries are marked "not currently obtainable"). It shows the recorded set
 * against the sync-computed recommendation with an honest match/mismatch verdict — and, when
 * nothing is recorded, an explicit unrecorded state rather than a guess. Saving PATCHes the move
 * ids and hands the updated Pokémon back to the page (which re-derives the recorded-move-type
 * coverage in the matchup panel).
 */

const LEGACY_NOTE = 'not currently obtainable'

/** A pool move as a Combobox option; legacy moves carry the "not currently obtainable" marker. */
const moveItem = (m: Move) => ({
  value: m.id,
  label: m.legacy ? `${m.name} — ${LEGACY_NOTE}` : m.name,
})

/** A recorded move rendered as a badge, keeping the legacy marker visible. */
const RecordedMove = ({ move }: { move: Move }) => (
  <Badge type={move.legacy ? 'warning' : 'neutral'}>
    {move.name}
    {move.legacy ? ` · ${LEGACY_NOTE}` : ''}
  </Badge>
)

export const MovesPanel = ({
  pokemon,
  onSaved,
}: {
  pokemon: Pokemon
  onSaved?: (updated: Pokemon) => void
}) => {
  const [pool, setPool] = useState<SpeciesMoves | null>(null)
  const [fast, setFast] = useState<string | null>(
    pokemon.moves.fast?.id ?? null,
  )
  const [charged1, setCharged1] = useState<string | null>(
    pokemon.moves.charged1?.id ?? null,
  )
  const [charged2, setCharged2] = useState<string | null>(
    pokemon.moves.charged2?.id ?? null,
  )
  const [poolError, setPoolError] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    getSpeciesMoves(pokemon.species.id, controller.signal)
      .then((p) => {
        if (active) setPool(p)
      })
      .catch(() => {
        // Surface the failure rather than leaving the selects mysteriously empty — an empty pool
        // usually means the catalog hasn't been synced (or the api lacks the moves endpoint).
        if (active) setPoolError(true)
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [pokemon.species.id])

  const fastItems = useMemo(() => (pool?.fastMoves ?? []).map(moveItem), [pool])
  const chargedItems = useMemo(
    () => (pool?.chargedMoves ?? []).map(moveItem),
    [pool],
  )
  // The optional second slot carries an explicit "None" to clear a previously-recorded move.
  const secondChargedItems = useMemo(
    () => [{ value: '', label: 'None' }, ...chargedItems],
    [chargedItems],
  )

  const nameOf = (id: string): string => {
    const all = [...(pool?.fastMoves ?? []), ...(pool?.chargedMoves ?? [])]
    return all.find((m) => m.id === id)?.name ?? id
  }

  // The verdict compares the *saved* recorded set (not the in-progress draft) against the
  // recommendation: matching = same fast move + the recommended charged move in either charged slot.
  const recorded = pokemon.moves
  const anyRecorded = !!(
    recorded.fast ||
    recorded.charged1 ||
    recorded.charged2
  )
  const rec = pool?.recommended ?? null
  const matchesRecommendation =
    !!rec &&
    recorded.fast?.id === rec.fastMoveId &&
    [recorded.charged1?.id, recorded.charged2?.id].includes(rec.chargedMoveId)

  const save = async () => {
    setSaving(true)
    try {
      const updated = await updatePokemon(pokemon.id, {
        fastMoveId: fast,
        chargedMove1Id: charged1,
        chargedMove2Id: charged2,
      })
      onSaved?.(updated)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <Stack as="section" aria-label="Moves" gap="4">
        <Heading size="md">Moves</Heading>

        {anyRecorded ? (
          <Stack gap="2">
            <HStack gap="2" wrap="wrap">
              {recorded.fast && <RecordedMove move={recorded.fast} />}
              {recorded.charged1 && <RecordedMove move={recorded.charged1} />}
              {recorded.charged2 && <RecordedMove move={recorded.charged2} />}
            </HStack>
            {rec && (
              <Text
                fontSize="sm"
                fontWeight="medium"
                color={matchesRecommendation ? 'fg.success' : 'text.muted'}
              >
                {matchesRecommendation
                  ? 'Matches the recommendation'
                  : 'Differs from the recommendation'}
              </Text>
            )}
          </Stack>
        ) : (
          <Text color="text.muted">No moves recorded yet</Text>
        )}

        {rec && (
          <Text fontSize="sm" color="text.muted">
            Recommended moveset: {nameOf(rec.fastMoveId)} +{' '}
            {nameOf(rec.chargedMoveId)}
          </Text>
        )}

        {poolError ? (
          <Callout status="error">
            We couldn&rsquo;t load this species&rsquo; move pool. The catalog
            may not be synced yet — try again after a catalog sync.
          </Callout>
        ) : (
          <>
            <Combobox
              label="Fast move"
              placeholder="Pick a fast move"
              items={fastItems}
              value={fast ? [fast] : []}
              onValueChange={(values) => setFast(values[0] ?? null)}
            />
            <Combobox
              label="Charged move"
              placeholder="Pick a charged move"
              items={chargedItems}
              value={charged1 ? [charged1] : []}
              onValueChange={(values) => setCharged1(values[0] ?? null)}
            />
            <Combobox
              label="Second charged move"
              helperText="Optional"
              placeholder="Pick a second charged move"
              items={secondChargedItems}
              value={charged2 ? [charged2] : []}
              onValueChange={(values) => setCharged2(values[0] || null)}
            />

            <Button onClick={save} loading={saving} alignSelf="flex-start">
              Save moves
            </Button>
          </>
        )}
      </Stack>
    </Card>
  )
}
