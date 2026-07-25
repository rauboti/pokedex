import { HStack, Stack, Text } from '@chakra-ui/react'
import { Badge, Card, EmptyState, Grid } from '@rauboti/ui'
import type { Pokemon } from '@/api/schemas'
import { FlagBadges } from './FlagBadges'
import { PokemonSprite } from './PokemonSprite'
import { TypeBadge } from './TypeBadge'

/**
 * The collection grid (US1/US2, FR-010). A responsive @rauboti/ui `Grid` of `Card`s — one card per
 * Pokémon, reflowing to more columns as the viewport widens so a large collection scrolls less. Each
 * card shows the species name+form, its types, and the server-derived level / CP / IV% read straight
 * from the DTO — the web app does no stat math (research D7). A rebalanced (`stale`) row wears a
 * "re-check" badge (FR-013 groundwork; the re-enter flow lands with T023). Kept as a `ul`/`li` list
 * for semantics; cards are presentational here (opening a card to the detail view lands with US3,
 * T025).
 *
 * When the list is empty it renders one of two empty states: `filtered` distinguishes "your filters
 * match nothing" from "you have registered nothing yet".
 */

const displayName = (species: Pokemon['species']) =>
  species.form ? `${species.name} (${species.form})` : species.name

export const PokemonList = ({
  pokemon,
  filtered = false,
}: {
  pokemon: Pokemon[]
  /** True when a filter is active, so an empty result reads as "no matches" not "nothing yet". */
  filtered?: boolean
}) => {
  if (pokemon.length === 0) {
    return (
      <EmptyState>
        {filtered
          ? 'No Pokémon match your filters.'
          : 'No Pokémon registered yet — register your first catch.'}
      </EmptyState>
    )
  }

  return (
    <Grid as="ul">
      {pokemon.map((p) => (
        <Card as="li" key={p.id}>
          <Stack gap="2">
            <HStack gap="3" align="start">
              <PokemonSprite pokemon={p} />
              <Stack gap="2" flex="1" minW="0">
                <HStack justify="space-between" wrap="wrap" gap="2">
                  <HStack gap="2" wrap="wrap">
                    <Text fontWeight="semibold">{displayName(p.species)}</Text>
                    {p.stale && <Badge type="warning">Needs re-check</Badge>}
                  </HStack>
                  <HStack gap="2">
                    {p.species.types.map((type) => (
                      <TypeBadge key={type} type={type} />
                    ))}
                  </HStack>
                </HStack>
                <HStack gap="4" wrap="wrap" color="text.muted" fontSize="sm">
                  <Text>Level {p.derived.level}</Text>
                  <Text>CP {p.cp}</Text>
                  <Text>{p.derived.ivPercent}%</Text>
                </HStack>
              </Stack>
            </HStack>
            <FlagBadges flags={p.flags} />
          </Stack>
        </Card>
      ))}
    </Grid>
  )
}
