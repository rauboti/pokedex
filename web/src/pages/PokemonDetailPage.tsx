import { useEffect, useState } from 'react'
import { Link as RouterLink, useParams } from 'react-router'
import {
  Center,
  HStack,
  Heading,
  Link as ChakraLink,
  Spinner,
  Stack,
  Text,
} from '@chakra-ui/react'
import { Callout, Card } from '@rauboti/ui'
import { ApiError } from '@/api/client'
import { getPokemon, type Pokemon } from '@/api/schemas'
import { PokemonAttributes } from '@/components/pokemon/PokemonAttributes'
import { PokemonSprite } from '@/components/pokemon/PokemonSprite'
import { TypeBadge } from '@/components/pokemon/TypeBadge'
import { StatsPanel } from '@/components/detail/StatsPanel'
import { ProjectionsPanel } from '@/components/detail/ProjectionsPanel'
import { MatchupPanel } from '@/components/detail/MatchupPanel'

/**
 * The Pokémon detail page (`/pokemon/:id`, US3). Refetches the Pokémon by id — the collection row
 * links here — and frames its server-derived stats ([StatsPanel]) and level projections
 * ([ProjectionsPanel]). A 404 (unknown or not the caller's own) resolves to a not-found state; other
 * failures show a generic Callout. Derived values are read straight from the DTO (no client math, D7).
 */

type State =
  | { status: 'loading' }
  | { status: 'ready'; pokemon: Pokemon }
  | { status: 'notFound' }
  | { status: 'error' }

const displayName = (species: Pokemon['species']) =>
  species.form ? `${species.name} (${species.form})` : species.name

const BackLink = () => (
  <ChakraLink asChild color="text.muted" alignSelf="flex-start">
    <RouterLink to="/">← Back to collection</RouterLink>
  </ChakraLink>
)

export const PokemonDetailPage = () => {
  const { id } = useParams()
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    if (!id) return
    let active = true
    const controller = new AbortController()
    getPokemon(id, controller.signal)
      .then((pokemon) => {
        if (active) setState({ status: 'ready', pokemon })
      })
      .catch((error) => {
        if (!active) return // aborted on unmount / id change
        if (error instanceof ApiError && error.status === 404) {
          setState({ status: 'notFound' })
        } else if (error instanceof ApiError) {
          setState({ status: 'error' })
        }
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [id])

  if (state.status === 'loading') {
    return (
      <Center role="status" aria-label="Loading Pokémon" py="10">
        <Spinner />
      </Center>
    )
  }

  if (state.status === 'notFound') {
    return (
      <Stack gap="4">
        <Heading size="lg">Pokémon not found</Heading>
        <Text color="text.muted">
          This Pokémon isn&rsquo;t in your collection.
        </Text>
        <BackLink />
      </Stack>
    )
  }

  if (state.status === 'error') {
    return (
      <Stack gap="4">
        <Callout status="error">
          We couldn&rsquo;t load this Pokémon. Please try again.
        </Callout>
        <BackLink />
      </Stack>
    )
  }

  const { pokemon } = state
  const { species, flags } = pokemon
  return (
    <Stack gap="4">
      <Card>
        <HStack gap="4" align="center" wrap="wrap">
          <PokemonSprite pokemon={pokemon} size="20" />
          <Stack gap="1" flex="1" minW="0">
            <HStack justify="space-between" align="start" wrap="wrap" gap="2">
              <HStack gap="3" align="center" wrap="wrap">
                <Heading size="lg">{displayName(species)}</Heading>
                <PokemonAttributes flags={flags} rarity={species.rarity} />
              </HStack>
              <HStack gap="1">
                {species.types.map((type) => (
                  <TypeBadge key={type} type={type} />
                ))}
              </HStack>
            </HStack>
            <Text color="text.muted" fontSize="sm">
              #{species.dexNr}
            </Text>
          </Stack>
        </HStack>
      </Card>

      <StatsPanel pokemon={pokemon} />
      <ProjectionsPanel projections={pokemon.derived.projections} />
      <MatchupPanel types={species.types} />

      <BackLink />
    </Stack>
  )
}
