import { useMemo } from 'react'
import { Combobox } from '@rauboti/ui'
import type { DerivationCandidate } from '@/api/schemas'

/**
 * Level disambiguation for a CP collision (US1 scenario 4). When the derivation returns more than one
 * candidate level for the entered CP, the player picks the right one; each option carries its
 * per-candidate stardust cost as an informational hint (dust ties within the low-level CP-floor
 * plateau where collisions actually occur — see the T016 amendment — so it is a hint, not the
 * differentiator). A single-select Combobox: the plateau can span more than a handful of half-levels
 * for a weak species at low IVs.
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
