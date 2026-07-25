import { HStack, Stack } from '@chakra-ui/react'
import { Card, Combobox, Input, SegmentedControl } from '@rauboti/ui'
import type { PokemonFilter, PokemonFlag } from '@/lib/filterPokemon'
import type { SortCriteria, SortDirection, SortKey } from '@/lib/sortPokemon'
import { POKEMON_TYPES } from './pokemonTypes'

/**
 * The collection filter/sort bar (US2, FR-006–FR-008 UI). A controlled component: it renders the
 * current filter + sort and emits the next value on every change — the parent owns the state and
 * applies it with the pure `lib/` functions (`filterPokemon`/`sortPokemon`, T021) when it renders the
 * list. No filtering happens here.
 *
 * Component choices reflect the current @rauboti/ui surface (the library dropped `Select` for
 * `Combobox` during T019): type + sort key are single-select `Combobox`es, flags a `Combobox multiple`
 * (its selections surface as removable tags — the same flag pattern the register dialog uses, since
 * the library still has no checkbox-group primitive), and sort direction a two-segment
 * `SegmentedControl`.
 */

export interface PokemonFiltersValue {
  filter: PokemonFilter
  sort: SortCriteria
}

const FLAG_ITEMS: { value: PokemonFlag; label: string }[] = [
  { value: 'shiny', label: 'Shiny' },
  { value: 'shadow', label: 'Shadow' },
  { value: 'lucky', label: 'Lucky' },
  { value: 'purified', label: 'Purified' },
  { value: 'bestBuddy', label: 'Best Buddy' },
]

const TYPE_ITEMS = POKEMON_TYPES.map((type) => ({ value: type, label: type }))

const SORT_ITEMS: { value: SortKey; label: string }[] = [
  { value: 'name', label: 'Species name' },
  { value: 'ivPercent', label: 'IV %' },
  { value: 'cp', label: 'CP' },
  { value: 'level', label: 'Level' },
  { value: 'caughtAt', label: 'Catch date' },
]

const DIRECTION_ITEMS = [
  { value: 'asc', label: 'Asc' },
  { value: 'desc', label: 'Desc' },
]

export const PokemonFilters = ({
  value,
  onChange,
}: {
  value: PokemonFiltersValue
  onChange: (next: PokemonFiltersValue) => void
}) => {
  const { filter, sort } = value
  const patchFilter = (patch: Partial<PokemonFilter>) =>
    onChange({ ...value, filter: { ...filter, ...patch } })
  const patchSort = (patch: Partial<SortCriteria>) =>
    onChange({ ...value, sort: { ...sort, ...patch } })

  return (
    <Card>
      <Stack gap="4">
        <HStack gap="3" align="end" wrap="wrap">
          <Input
            label="Species"
            placeholder="Search by name"
            value={filter.species ?? ''}
            onChange={(event) => patchFilter({ species: event.target.value })}
          />
          <Combobox
            label="Type"
            placeholder="Any type"
            items={TYPE_ITEMS}
            value={filter.type ? [filter.type] : []}
            onValueChange={(values) => patchFilter({ type: values[0] ?? '' })}
          />
          <Combobox
            label="Flags"
            multiple
            placeholder="Any flags"
            items={FLAG_ITEMS}
            value={filter.flags ?? []}
            onValueChange={(values) =>
              patchFilter({ flags: values as PokemonFlag[] })
            }
          />
        </HStack>

        <HStack gap="3" align="end" wrap="wrap">
          <Combobox
            label="Sort by"
            items={SORT_ITEMS}
            value={[sort.key]}
            onValueChange={(values) => {
              const key = values[0]
              if (key) patchSort({ key: key as SortKey })
            }}
          />
          <SegmentedControl
            label="Direction"
            items={DIRECTION_ITEMS}
            value={sort.direction}
            onValueChange={(direction) =>
              patchSort({ direction: direction as SortDirection })
            }
          />
        </HStack>
      </Stack>
    </Card>
  )
}
