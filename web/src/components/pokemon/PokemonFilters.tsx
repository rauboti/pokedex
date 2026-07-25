import { Box, HStack, Image, Text } from '@chakra-ui/react'
import {
  Button,
  Combobox,
  FilterIcon,
  Input,
  Popover,
  SearchIcon,
  SortIcon,
  Tag,
} from '@rauboti/ui'
import type { PokemonFilter, PokemonFlag } from '@/lib/filterPokemon'
import type { SortCriteria, SortDirection, SortKey } from '@/lib/sortPokemon'
import { POKEMON_TYPES, TYPE_ICONS } from './pokemonTypes'

/**
 * The collection's search / filter / sort controls (US2, FR-006–FR-008 UI), grouped by function
 * behind three icon buttons that each open a `@rauboti/ui` `Popover` — so the toolbar costs almost no
 * space and the collection stays live behind each panel. A controlled component: it renders the
 * current filter + sort and emits the next value on every change; the page applies it with the pure
 * `lib/` functions (`filterPokemon`/`sortPokemon`, T021). {@link PokemonFilterSummary} renders the
 * active state as a one-line summary.
 *
 * - **Search** — a text field over the species name.
 * - **Filter** — one `multiple` `Combobox` grouping the 18 types (each with its icon) and the 5 flags
 *   under headings separated by a divider; a Pokémon matches any selected **type** (OR) and must carry
 *   every selected **flag** (AND). Empty = "All".
 * - **Sort** — a single `Combobox` whose options fold key and direction together (Name Asc/Desc, …),
 *   replacing a separate direction toggle.
 *
 * Every control is `required` so none shows the DS "(optional)" hint (all three always resolve to a
 * value — an empty filter is "All", sort always has a selection).
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
const FLAG_VALUES = new Set<string>(FLAG_ITEMS.map((f) => f.value))
const FLAG_LABEL: Record<string, string> = Object.fromEntries(
  FLAG_ITEMS.map((f) => [f.value, f.label]),
)

/** Filter options grouped as Types (each with its vendored type icon) and Flags. The icon is
 *  decorative (`alt=""`) — the label already names the option. */
const FILTER_ITEMS = {
  Types: POKEMON_TYPES.map((type) => ({
    value: type,
    label: type,
    icon: <Image src={TYPE_ICONS[type]} alt="" boxSize="4" />,
  })),
  Flags: FLAG_ITEMS,
}

/** Sort options fold the key and direction into one value (`"<key>:<dir>"`). */
const SORT_ITEMS: { value: `${SortKey}:${SortDirection}`; label: string }[] = [
  { value: 'name:asc', label: 'Name Asc' },
  { value: 'name:desc', label: 'Name Desc' },
  { value: 'ivPercent:asc', label: 'IV % Asc' },
  { value: 'ivPercent:desc', label: 'IV % Desc' },
  { value: 'cp:asc', label: 'CP Asc' },
  { value: 'cp:desc', label: 'CP Desc' },
  { value: 'level:asc', label: 'Level Asc' },
  { value: 'level:desc', label: 'Level Desc' },
  { value: 'caughtAt:asc', label: 'Catch date Asc' },
  { value: 'caughtAt:desc', label: 'Catch date Desc' },
]
const SORT_LABEL: Record<string, string> = Object.fromEntries(
  SORT_ITEMS.map((s) => [s.value, s.label]),
)

const sortValue = (sort: SortCriteria) => `${sort.key}:${sort.direction}`

const iconTrigger = (label: string, icon: React.ReactNode) => (
  <Button variant="ghost" aria-label={label}>
    {icon}
  </Button>
)

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

  const filterSelection = [...(filter.types ?? []), ...(filter.flags ?? [])]

  return (
    <HStack gap="1">
      <Popover
        placement="bottom-end"
        trigger={iconTrigger('Search', <SearchIcon size={18} />)}
      >
        <Box minW="15rem">
          <Input
            label="Search"
            required
            placeholder="Search by name"
            value={filter.species ?? ''}
            onChange={(event) => patchFilter({ species: event.target.value })}
          />
        </Box>
      </Popover>

      <Popover
        placement="bottom-end"
        trigger={iconTrigger('Filter', <FilterIcon size={18} />)}
      >
        <Box minW="16rem">
          <Combobox
            label="Filter"
            required
            multiple
            placeholder="All"
            items={FILTER_ITEMS}
            value={filterSelection}
            onValueChange={(selected) =>
              patchFilter({
                types: selected.filter((v) => !FLAG_VALUES.has(v)),
                flags: selected.filter((v) =>
                  FLAG_VALUES.has(v),
                ) as PokemonFlag[],
              })
            }
          />
        </Box>
      </Popover>

      <Popover
        placement="bottom-end"
        trigger={iconTrigger('Sort', <SortIcon size={18} />)}
      >
        <Box minW="14rem">
          <Combobox
            label="Sort by"
            required
            items={SORT_ITEMS}
            value={[sortValue(sort)]}
            onValueChange={(selected) => {
              const v = selected[0]
              if (!v) return
              const [key, direction] = v.split(':') as [SortKey, SortDirection]
              onChange({ ...value, sort: { key, direction } })
            }}
          />
        </Box>
      </Popover>
    </HStack>
  )
}

/**
 * The active search / filter / sort, shown as the toolbar's second row. Each active search term and
 * filter is a **removable `Tag`** so it clears in one click (no reopening the popover), with a
 * "Clear all" shortcut; the sort trails as muted text (it always has a value, so it isn't clearable).
 */
export const PokemonFilterSummary = ({
  value,
  onChange,
}: {
  value: PokemonFiltersValue
  onChange: (next: PokemonFiltersValue) => void
}) => {
  const { filter, sort } = value
  const patchFilter = (patch: Partial<PokemonFilter>) =>
    onChange({ ...value, filter: { ...filter, ...patch } })

  const chips: {
    key: string
    label: string
    closeLabel: string
    remove: () => void
  }[] = []
  if (filter.species?.trim()) {
    chips.push({
      key: 'search',
      label: `Search: ${filter.species.trim()}`,
      closeLabel: 'Clear search',
      remove: () => patchFilter({ species: '' }),
    })
  }
  for (const type of filter.types ?? []) {
    chips.push({
      key: `type:${type}`,
      label: type,
      closeLabel: `Remove ${type}`,
      remove: () =>
        patchFilter({ types: (filter.types ?? []).filter((t) => t !== type) }),
    })
  }
  for (const flag of filter.flags ?? []) {
    const label = FLAG_LABEL[flag] ?? flag
    chips.push({
      key: `flag:${flag}`,
      label,
      closeLabel: `Remove ${label}`,
      remove: () =>
        patchFilter({ flags: (filter.flags ?? []).filter((f) => f !== flag) }),
    })
  }

  return (
    <HStack gap="2" wrap="wrap">
      {chips.map((chip) => (
        <Tag
          key={chip.key}
          closable
          closeLabel={chip.closeLabel}
          onClose={chip.remove}
        >
          {chip.label}
        </Tag>
      ))}
      {chips.length > 0 && (
        <Button
          size="xs"
          variant="ghost"
          onClick={() => onChange({ ...value, filter: {} })}
        >
          Clear all
        </Button>
      )}
      <Text color="text.muted" fontSize="sm">
        Sorted by {SORT_LABEL[sortValue(sort)] ?? sortValue(sort)}
      </Text>
    </HStack>
  )
}
