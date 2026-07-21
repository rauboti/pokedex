import { useEffect, useState } from 'react'
import { Center, Spinner, Stack, Text } from '@chakra-ui/react'
import { Callout, EmptyState, PageHeader } from '@rauboti/ui'
import {
  getCatalog,
  listPokemon,
  type CatalogStatus,
  type Pokemon,
} from '@/api/schemas'
import { RegisterDialog } from '@/components/pokemon/RegisterDialog'
import { PokemonList } from '@/components/pokemon/PokemonList'

/**
 * The collection landing page (`/`, US1). Fetches the caller's Pokémon and the catalog status on
 * mount, frames them in the @rauboti/ui `PageHeader` (with the Register dialog as its action), and
 * shows a loading indicator / error Callout / empty state as appropriate. A successful registration
 * prepends the new row without a refetch. Derived values are rendered straight from the DTO — no
 * client stat math (research D7). Filtering/sorting and edit/delete land with US2 (T022/T023).
 */
export const CollectionPage = () => {
  const [pokemon, setPokemon] = useState<Pokemon[]>([])
  const [catalog, setCatalog] = useState<CatalogStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    listPokemon()
      .then((list) => {
        if (!active) return
        setPokemon(list)
        setLoading(false)
      })
      .catch(() => {
        if (!active) return
        setFailed(true)
        setLoading(false)
      })
    // Catalog freshness is secondary — a failure here doesn't blank the collection.
    getCatalog()
      .then((status) => {
        if (active) setCatalog(status)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const freshness = catalog
    ? catalog.syncedAt
      ? `Catalog synced ${new Date(catalog.syncedAt).toLocaleDateString()}`
      : 'Catalog not synced yet'
    : null

  return (
    <Stack gap="4">
      <PageHeader
        title="Collection"
        actions={
          <RegisterDialog
            onCreated={(created) => setPokemon((prev) => [created, ...prev])}
          />
        }
      />

      {freshness && (
        <Text color="text.muted" fontSize="sm">
          {freshness}
        </Text>
      )}

      {loading ? (
        <Center role="status" aria-label="Loading your collection" py="10">
          <Spinner />
        </Center>
      ) : failed ? (
        <Callout status="error">
          We couldn&rsquo;t load your collection. Please try again.
        </Callout>
      ) : pokemon.length === 0 ? (
        <EmptyState>
          No Pokémon registered yet — register your first catch.
        </EmptyState>
      ) : (
        <PokemonList pokemon={pokemon} />
      )}
    </Stack>
  )
}
