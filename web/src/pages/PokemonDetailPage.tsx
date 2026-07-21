import { Heading, Stack } from '@chakra-ui/react'
import { useParams } from 'react-router'

/**
 * The Pokémon detail page (`/pokemon/:id`) — placeholder shell. Stats/projections, matchups and the
 * moves panel land in US3–US5 (T025/T027/T029), which refetch by id.
 */
export const PokemonDetailPage = () => {
  const { id } = useParams()
  return (
    <Stack gap="4">
      <Heading size="lg">Pokémon</Heading>
      <span data-testid="pokemon-id">{id}</span>
    </Stack>
  )
}
