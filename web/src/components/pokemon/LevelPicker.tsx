import { useMemo } from 'react'
import { Combobox } from '@rauboti/ui'
import type { DerivationCandidate } from '@/api/schemas'

/**
 * Level disambiguation when the derivation returns more than one candidate. Dust is shown as an
 * informational hint, *not* the differentiator — it ties across the CP-floor plateau where collisions
 * actually occur. A Combobox rather than radios: the plateau can span many half-levels.
 */

const formatDust = (dust: number) => dust.toLocaleString('en-US')

export const LevelPicker = ({
  candidates,
  value,
  onChange,
}: {
  candidates: DerivationCandidate[]
  value: number | null
  onChange: (level: number) => void
}) => {
  // Stable items reference (Combobox syncs `items` into its collection on change).
  const items = useMemo(
    () =>
      candidates.map((candidate) => ({
        value: String(candidate.level),
        label: `Level ${candidate.level} · ${formatDust(candidate.dustCost)} Stardust`,
      })),
    [candidates],
  )

  return (
    <Combobox
      label="Level"
      required
      placeholder="Pick the level you powered up to"
      helperText="This CP matches more than one level — pick the one you powered up to."
      value={value === null ? [] : [String(value)]}
      onValueChange={(values) => {
        const picked = values[0]
        if (picked !== undefined) onChange(Number(picked))
      }}
      items={items}
    />
  )
}
