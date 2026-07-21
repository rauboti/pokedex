import { HStack, Stack, Text } from '@chakra-ui/react'
import { Badge, Card, Grid } from '@rauboti/ui'
import type { Pokemon } from '@/api/schemas'
import { FlagBadges } from './FlagBadges'
import { PokemonSprite } from './PokemonSprite'

/**
 * The collection grid (US1, FR-010). A responsive @rauboti/ui `Grid` of `Card`s — one card per
 * Pokémon, reflowing to more columns as the viewport widens so a large collection scrolls less. Each
 * card shows the species name+form, its types, and the server-derived level / CP / IV% read straight
 * from the DTO — the web app does no stat math (research D7). Kept as a `ul`/`li` list for
 * semantics; cards are presentational here (opening a card to the detail view lands with US3, T025).
 */

const displayName = (species: Pokemon['species']) =>
  species.form ? `${species.name} (${species.form})` : species.name

export const PokemonList = ({ pokemon }: { pokemon: Pokemon[] }) => (
  <Grid as="ul">
    {pokemon.map((p) => (
      <Card as="li" key={p.id}>
        <Stack gap="2">
          <HStack gap="3" align="start">
            <PokemonSprite pokemon={p} />
            <Stack gap="2" flex="1" minW="0">
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
            </Stack>
          </HStack>
          <FlagBadges flags={p.flags} />
        </Stack>
      </Card>
    ))}
  </Grid>
)
