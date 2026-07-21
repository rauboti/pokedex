import { type ReactNode, useEffect, useState } from 'react'
import { HStack, Stack, Text } from '@chakra-ui/react'
import {
  Badge,
  Button,
  Callout,
  Card,
  Combobox,
  Dialog,
  Input,
} from '@rauboti/ui'
import {
  createPokemon,
  derive,
  type DerivationCandidate,
  type PokemonInput,
  type Pokemon,
  type Species,
} from '@/api/schemas'
import { SpeciesSearch } from './SpeciesSearch'
import { LevelPicker } from './LevelPicker'

/**
 * The MVP register flow (US1, FR-001–FR-005 web side): search a species, enter IVs + the observed CP,
 * preview the **server-derived** level/HP/stats/IV%, disambiguate a CP collision, reject an impossible
 * combination, set flags + catch date, and save. The dialog does no stat math — the preview reads
 * `POST /api/derivation` (research D7) and the authoritative derived block comes back from
 * `POST /api/pokemon`. Save is blocked until the derivation confirms exactly one level (auto-selected
 * when unambiguous, chosen from the [LevelPicker] on a collision, impossible when the candidate list
 * is empty). No nickname field (spec assumption 2026-07-20).
 *
 * The derivation result is kept keyed to the exact inputs that produced it, and everything the UI
 * needs (candidates, the effective level, save-ability) is derived during render. So state is only
 * ever written from async callbacks / event handlers, never synchronously inside the effect, and a
 * result can never be shown against inputs it wasn't computed for.
 */

/** The catchable flags, as Combobox options (value = the PokemonInput flag key). */
const FLAG_ITEMS = [
  { value: 'shiny', label: 'Shiny' },
  { value: 'shadow', label: 'Shadow' },
  { value: 'lucky', label: 'Lucky' },
  { value: 'purified', label: 'Purified' },
  { value: 'bestBuddy', label: 'Best Buddy' },
]

/** The derivation result tagged with the input signature it was computed for, so a stale response
 *  is never rendered against changed inputs. */
type Derivation = { key: string; candidates: DerivationCandidate[] }

/** Clamp an IV text field to the game's 0–15 range, tolerating an empty field mid-edit. */
const clampIv = (raw: string): string => {
  if (raw.trim() === '') return ''
  const n = Math.trunc(Number(raw))
  if (Number.isNaN(n)) return ''
  return String(Math.min(15, Math.max(0, n)))
}

const ivNum = (raw: string): number => Number(raw || '0')

export const RegisterDialog = ({
  trigger,
  onCreated,
}: {
  trigger?: ReactNode
  onCreated?: (pokemon: Pokemon) => void
}) => {
  const [open, setOpen] = useState(false)

  const [species, setSpecies] = useState<Species | null>(null)
  const [ivAtk, setIvAtk] = useState('0')
  const [ivDef, setIvDef] = useState('0')
  const [ivSta, setIvSta] = useState('0')
  const [cpText, setCpText] = useState('')
  const [flagValues, setFlagValues] = useState<string[]>([])
  const [caughtAt, setCaughtAt] = useState('')

  const [derivation, setDerivation] = useState<Derivation | null>(null)
  const [pickedLevel, setPickedLevel] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cp = cpText.trim() === '' ? null : Number(cpText)
  const cpValid = cp !== null && !Number.isNaN(cp) && cp >= 10
  const inputKey = `${species?.id ?? ''}|${ivAtk}|${ivDef}|${ivSta}|${cpText}`

  const reset = () => {
    setSpecies(null)
    setIvAtk('0')
    setIvDef('0')
    setIvSta('0')
    setCpText('')
    setFlagValues([])
    setCaughtAt('')
    setDerivation(null)
    setPickedLevel(null)
    setError(null)
  }

  // Preview: whenever the derivation inputs are complete, ask the server for the candidate level(s).
  // A liveness guard drops a stale response (the client `derive` has no abort seam) and the result is
  // tagged with `inputKey` so render only trusts it while the inputs still match.
  useEffect(() => {
    const cpValue = Number(cpText)
    if (
      !species ||
      cpText.trim() === '' ||
      Number.isNaN(cpValue) ||
      cpValue < 10
    ) {
      return
    }
    let active = true
    derive({
      speciesId: species.id,
      ivAtk: ivNum(ivAtk),
      ivDef: ivNum(ivDef),
      ivSta: ivNum(ivSta),
      cp: cpValue,
    })
      .then((result) => {
        if (!active) return
        setDerivation({ key: inputKey, candidates: result.candidates })
        setError(null)
      })
      .catch(() => {
        if (active) setError('Could not check that CP — please try again.')
      })
    return () => {
      active = false
    }
  }, [species, ivAtk, ivDef, ivSta, cpText, inputKey])

  // Everything below is derived from the (input-matched) derivation — no effect-synced state.
  const candidates = derivation?.key === inputKey ? derivation.candidates : null
  const selectedLevel =
    candidates == null
      ? null
      : candidates.length === 1
        ? candidates[0].level
        : candidates.some((c) => c.level === pickedLevel)
          ? pickedLevel
          : null
  const selectedCandidate =
    candidates?.find((c) => c.level === selectedLevel) ?? null
  const impossible = candidates != null && candidates.length === 0
  const ivPercent =
    Math.round(((ivNum(ivAtk) + ivNum(ivDef) + ivNum(ivSta)) / 45) * 100 * 10) /
    10

  const canSave =
    !!species &&
    cpValid &&
    candidates != null &&
    candidates.length > 0 &&
    selectedLevel != null &&
    !submitting

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSave || !species || cp === null || selectedLevel === null) return
    const input: PokemonInput = {
      speciesId: species.id,
      ivAtk: ivNum(ivAtk),
      ivDef: ivNum(ivDef),
      ivSta: ivNum(ivSta),
      cp,
      level: selectedLevel,
      shiny: flagValues.includes('shiny'),
      shadow: flagValues.includes('shadow'),
      lucky: flagValues.includes('lucky'),
      purified: flagValues.includes('purified'),
      bestBuddy: flagValues.includes('bestBuddy'),
      ...(caughtAt ? { caughtAt } : {}),
    }
    setSubmitting(true)
    setError(null)
    createPokemon(input)
      .then((created) => {
        onCreated?.(created)
        setOpen(false)
        reset()
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Could not save')
      })
      .finally(() => setSubmitting(false))
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
      trigger={trigger ?? <Button>Register</Button>}
      title="Register a Pokémon"
      asForm
      onSubmit={handleSubmit}
      footer={
        <Button type="submit" disabled={!canSave}>
          Save
        </Button>
      }
    >
      <Stack gap="4">
        {error && <Callout status="error">{error}</Callout>}

        <SpeciesSearch onSelect={setSpecies} />
        {species && (
          <HStack gap="1">
            {species.types.map((type) => (
              <Badge key={type}>{type}</Badge>
            ))}
          </HStack>
        )}

        <HStack gap="3" align="start">
          <Input
            label="Attack IV"
            required
            type="number"
            min={0}
            max={15}
            value={ivAtk}
            onChange={(e) => setIvAtk(clampIv(e.target.value))}
          />
          <Input
            label="Defense IV"
            required
            type="number"
            min={0}
            max={15}
            value={ivDef}
            onChange={(e) => setIvDef(clampIv(e.target.value))}
          />
          <Input
            label="Stamina IV"
            required
            type="number"
            min={0}
            max={15}
            value={ivSta}
            onChange={(e) => setIvSta(clampIv(e.target.value))}
          />
        </HStack>

        <Input
          label="CP"
          required
          type="number"
          min={10}
          value={cpText}
          onChange={(e) => setCpText(e.target.value)}
          helperText="The CP shown in-game (10 or more)."
        />

        {impossible && (
          <Callout status="warning">
            No level matches that CP for those IVs — double-check the CP you
            entered.
          </Callout>
        )}

        {candidates && candidates.length > 1 && (
          <LevelPicker
            candidates={candidates}
            value={selectedLevel}
            onChange={setPickedLevel}
          />
        )}

        {selectedCandidate && (
          <Card>
            <Stack gap="1">
              <Text fontWeight="semibold">Level {selectedCandidate.level}</Text>
              <Text>HP {selectedCandidate.hp}</Text>
              <Text>Attack {selectedCandidate.attack}</Text>
              <Text>Defense {selectedCandidate.defense}</Text>
              <Text>Stamina {selectedCandidate.stamina}</Text>
              <Text>IV {ivPercent}%</Text>
            </Stack>
          </Card>
        )}

        <Combobox
          label="Flags"
          multiple
          placeholder="Add flags…"
          items={FLAG_ITEMS}
          value={flagValues}
          onValueChange={setFlagValues}
        />
        {flagValues.includes('bestBuddy') && (
          <Text fontSize="sm" color="text.muted">
            A CP read while this Pokémon is your Best Buddy is boosted — the
            derivation resolves the boosted (+1) level.
          </Text>
        )}

        <Input
          label="Catch date"
          type="date"
          value={caughtAt}
          onChange={(e) => setCaughtAt(e.target.value)}
        />
      </Stack>
    </Dialog>
  )
}
