import { useEffect, useMemo, useState } from 'react'
import { Heading, Stack, Table, Text } from '@chakra-ui/react'
import {
  Button,
  Callout,
  Card,
  Combobox,
  Dialog,
  Grid,
  PencilIcon,
  SegmentedControl,
} from '@rauboti/ui'
import {
  getSpeciesMoves,
  updatePokemon,
  type Move,
  type Pokemon,
  type SpeciesMoves,
} from '@/api/schemas'
import { TypeBadge } from '@/components/pokemon/TypeBadge'

/**
 * Recommended vs actually-recorded moves side by side, with a match/mismatch verdict and an explicit
 * unrecorded state — never a guess (US5). Saving hands the updated Pokémon back to the page, which
 * re-derives the recorded-move coverage in the matchup panel.
 */

const LEGACY_NOTE = 'not currently obtainable'

/** Legacy moves carry the "not currently obtainable" marker. */
const moveItem = (m: Move) => ({
  value: m.id,
  label: m.legacy ? `${m.name} — ${LEGACY_NOTE}` : m.name,
})

interface MoveRow {
  key: string
  type: string
  name: string
  legacy?: boolean | null
}

const moveRow = (key: string, move: Move): MoveRow => ({
  key,
  type: move.type,
  name: move.name,
  legacy: move.legacy,
})

/** Shared by both halves. Shows an explicit empty message rather than a bare table. */
const MoveTable = ({
  heading,
  rows,
  emptyText,
}: {
  heading: string
  rows: MoveRow[]
  emptyText: string
}) => (
  <Stack as="section" aria-label={heading} gap="2">
    <Heading size="sm">{heading}</Heading>
    {rows.length === 0 ? (
      <Text color="text.muted" fontSize="sm">
        {emptyText}
      </Text>
    ) : (
      <Table.ScrollArea borderWidth="1px" borderColor="border" rounded="md">
        <Table.Root
          size="sm"
          variant="line"
          css={{ '& tr': { background: 'transparent' } }}
        >
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>Type</Table.ColumnHeader>
              <Table.ColumnHeader>Move</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {rows.map((r) => (
              <Table.Row key={r.key}>
                <Table.Cell>
                  <TypeBadge type={r.type} />
                </Table.Cell>
                <Table.Cell>
                  {r.name}
                  {r.legacy ? ` · ${LEGACY_NOTE}` : ''}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Table.ScrollArea>
    )}
  </Stack>
)

/** Offers only the species pool. Selects are `required` to suppress the DS "(optional)" label. */
const MovesEditDialog = ({
  pokemon,
  pool,
  onSaved,
}: {
  pokemon: Pokemon
  pool: SpeciesMoves
  onSaved?: (updated: Pokemon) => void
}) => {
  const [open, setOpen] = useState(false)
  const [fast, setFast] = useState<string | null>(null)
  const [charged1, setCharged1] = useState<string | null>(null)
  const [charged2, setCharged2] = useState<string | null>(null)
  const [chargedCount, setChargedCount] = useState('1')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  // Seed the draft from the current record each time the modal opens.
  const reset = () => {
    setFast(pokemon.moves.fast?.id ?? null)
    setCharged1(pokemon.moves.charged1?.id ?? null)
    setCharged2(pokemon.moves.charged2?.id ?? null)
    setChargedCount(pokemon.moves.charged2 ? '2' : '1')
    setError(false)
  }

  const fastItems = pool.fastMoves.map(moveItem)
  const chargedItems = pool.chargedMoves.map(moveItem)
  const canSave = !!fast && !!charged1 && (chargedCount === '1' || !!charged2)

  const save = async () => {
    setSaving(true)
    setError(false)
    try {
      const updated = await updatePokemon(pokemon.id, {
        fastMoveId: fast,
        chargedMove1Id: charged1,
        chargedMove2Id: chargedCount === '2' ? charged2 : null,
      })
      onSaved?.(updated)
      setOpen(false)
    } catch {
      setError(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) reset()
        setOpen(next)
      }}
      trigger={
        <Button variant="ghost" aria-label="Edit moves" alignSelf="flex-end">
          <PencilIcon />
        </Button>
      }
      title="Set moves"
      footer={
        <Button onClick={save} loading={saving} disabled={!canSave}>
          Save moves
        </Button>
      }
    >
      <Stack gap="4">
        {error && (
          <Callout status="error">
            We couldn&rsquo;t save these moves. Please try again.
          </Callout>
        )}
        <Combobox
          label="Fast move"
          required
          placeholder="Pick a fast move"
          items={fastItems}
          value={fast ? [fast] : []}
          onValueChange={(values) => setFast(values[0] ?? null)}
        />
        <SegmentedControl
          label="Number of charged attacks"
          required
          items={[
            { value: '1', label: '1' },
            { value: '2', label: '2' },
          ]}
          value={chargedCount}
          onValueChange={setChargedCount}
        />
        <Combobox
          label="Charged move 1"
          required
          placeholder="Pick a charged move"
          items={chargedItems}
          value={charged1 ? [charged1] : []}
          onValueChange={(values) => setCharged1(values[0] ?? null)}
        />
        {chargedCount === '2' && (
          <Combobox
            label="Charged move 2"
            required
            placeholder="Pick a second charged move"
            items={chargedItems}
            value={charged2 ? [charged2] : []}
            onValueChange={(values) => setCharged2(values[0] ?? null)}
          />
        )}
      </Stack>
    </Dialog>
  )
}

export const MovesPanel = ({
  pokemon,
  onSaved,
}: {
  pokemon: Pokemon
  onSaved?: (updated: Pokemon) => void
}) => {
  const [pool, setPool] = useState<SpeciesMoves | null>(null)
  const [poolError, setPoolError] = useState(false)

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    getSpeciesMoves(pokemon.species.id, controller.signal)
      .then((p) => {
        if (active) setPool(p)
      })
      .catch(() => {
        // Surface it — an empty pool usually means the catalog hasn't been synced.
        if (active) setPoolError(true)
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [pokemon.species.id])

  const byId = useMemo(() => {
    const all = [...(pool?.fastMoves ?? []), ...(pool?.chargedMoves ?? [])]
    return new Map(all.map((m) => [m.id, m]))
  }, [pool])

  const recommendedRows: MoveRow[] = useMemo(() => {
    const rec = pool?.recommended
    if (!rec) return []
    return [
      ['fast', rec.fastMoveId] as const,
      ['charged', rec.chargedMoveId] as const,
    ].map(([slot, id]) => {
      const m = byId.get(id)
      return m
        ? moveRow(`rec-${slot}`, m)
        : { key: `rec-${slot}`, type: '', name: id }
    })
  }, [pool, byId])

  const recorded = pokemon.moves
  const actualRows: MoveRow[] = [
    recorded.fast ? moveRow('act-fast', recorded.fast) : null,
    recorded.charged1 ? moveRow('act-charged1', recorded.charged1) : null,
    recorded.charged2 ? moveRow('act-charged2', recorded.charged2) : null,
  ].filter((r): r is MoveRow => r !== null)

  const anyRecorded = actualRows.length > 0
  const rec = pool?.recommended ?? null
  const matchesRecommendation =
    !!rec &&
    recorded.fast?.id === rec.fastMoveId &&
    [recorded.charged1?.id, recorded.charged2?.id].includes(rec.chargedMoveId)

  return (
    <Card>
      <Stack as="section" aria-label="Moves" gap="4">
        <Heading size="md">Moves</Heading>

        {anyRecorded && rec && (
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

        <Grid columns={{ base: 1, md: 2 }} gap="4">
          <MoveTable
            heading="Recommended"
            rows={recommendedRows}
            emptyText={
              poolError
                ? 'Couldn’t load the recommendation.'
                : 'No recommendation yet.'
            }
          />
          <MoveTable
            heading="Actual"
            rows={actualRows}
            emptyText="No moves recorded yet"
          />
        </Grid>

        {poolError ? (
          <Callout status="error">
            We couldn&rsquo;t load this species&rsquo; move pool, so moves
            can&rsquo;t be edited. The catalog may not be synced yet.
          </Callout>
        ) : (
          pool && (
            <MovesEditDialog pokemon={pokemon} pool={pool} onSaved={onSaved} />
          )
        )}
      </Stack>
    </Card>
  )
}
