import { HStack, Stack, Text } from '@chakra-ui/react'
import { Badge, List } from '@rauboti/ui'
import type { Pokemon } from '@/api/schemas'
import { FlagBadges } from './FlagBadges'

/**
 * The collection list (US1, FR-010). One `List.Item` (a bordered surface row) per Pokémon, showing
 * the species name+form, its types, and the server-derived level / CP / IV% read straight from the
 * DTO — the web app does no stat math (research D7). Rows are presentational here; opening a row to
 * the detail view lands with US3 (T025).
 */

const displayName = (species: Pokemon['species']) =>
  species.form ? `${species.name} (${species.form})` : species.name

export const PokemonList = ({ pokemon }: { pokemon: Pokemon[] }) => (
  <List>
    {pokemon.map((p) => (
      <List.Item key={p.id}>
        <Stack gap="2">
          <HStack justify="space-between" wrap="wrap" gap="2">
            <Text fontWeight="semibold">{displayName(p.species)}</Text>
            <HStack gap="1">
              {p.species.types.map((type) => (
                <Badge key={type}>{type}</Badge>
              ))}
            </HStack>
          </HStack>
          <HStack gap="4" wrap="wrap" color="text.muted" fontSize="sm">
            <Text>Level {p.derived.level}</Text>
            <Text>CP {p.cp}</Text>
            <Text>{p.derived.ivPercent}%</Text>
          </HStack>
          <FlagBadges flags={p.flags} />
        </Stack>
      </List.Item>
    ))}
  </List>
)
