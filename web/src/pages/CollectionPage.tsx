import { useEffect, useMemo, useState } from 'react'
import { Center, HStack, Spinner, Stack, Text } from '@chakra-ui/react'
import { Button, Callout, Dialog, PageHeader } from '@rauboti/ui'
import {
  deletePokemon,
  getCatalog,
  listPokemon,
  type CatalogStatus,
  type Pokemon,
} from '@/api/schemas'
import { RegisterDialog } from '@/components/pokemon/RegisterDialog'
import { PokemonList } from '@/components/pokemon/PokemonList'
import {
  PokemonFilters,
  PokemonFilterSummary,
  type PokemonFiltersValue,
} from '@/components/pokemon/PokemonFilters'
import { filterPokemon, hasActiveFilters } from '@/lib/filterPokemon'
import { sortPokemon } from '@/lib/sortPokemon'

/**
 * The collection landing page (`/`, US1 + US2). Fetches the caller's Pokémon and the catalog status
 * on mount, frames them in the @rauboti/ui `PageHeader` (with the Register dialog as its action), and
 * shows a loading indicator / error Callout / empty state as appropriate. Filtering + sorting run
 * client-side over the full collection via the pure `lib/` functions (research D10); a row can be
 * edited (the prefilled dialog, re-deriving on save) or deleted (after a confirmation). A stale row's
 * "re-enter" opens the same edit flow and the successful re-derive clears its badge (FR-013).
 * Derived values are rendered straight from the DTO — no client stat math (research D7).
 */

const displayName = (species: Pokemon['species']) =>
  species.form ? `${species.name} (${species.form})` : species.name

export const CollectionPage = () => {
  const [pokemon, setPokemon] = useState<Pokemon[]>([])
  const [catalog, setCatalog] = useState<CatalogStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [filters, setFilters] = useState<PokemonFiltersValue>({
    filter: {},
    sort: { key: 'name', direction: 'asc' },
  })
  const [editing, setEditing] = useState<Pokemon | null>(null)
  const [deleting, setDeleting] = useState<Pokemon | null>(null)
  const [deleteFailed, setDeleteFailed] = useState(false)

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

  const { filter, sort } = filters
  const filtered = hasActiveFilters(filter)
  const showTools = !loading && !failed && pokemon.length > 0

  const shown = useMemo(
    () => sortPokemon(filterPokemon(pokemon, filter), sort),
    [pokemon, filter, sort],
  )

  const confirmDelete = () => {
    if (!deleting) return
    const id = deleting.id
    deletePokemon(id)
      .then(() => {
        setPokemon((prev) => prev.filter((p) => p.id !== id))
        setDeleting(null)
      })
      .catch(() => setDeleteFailed(true))
  }

  return (
    <Stack gap="4">
      <PageHeader
        title="Collection"
        actions={
          <HStack gap="2">
            {showTools && (
              <PokemonFilters value={filters} onChange={setFilters} />
            )}
            <RegisterDialog
              onCreated={(created) => setPokemon((prev) => [created, ...prev])}
            />
          </HStack>
        }
      />

      <HStack justify="space-between" gap="3" wrap="wrap">
        {freshness && (
          <Text color="text.muted" fontSize="sm">
            {freshness}
          </Text>
        )}
        {showTools && (
          <PokemonFilterSummary value={filters} onChange={setFilters} />
        )}
      </HStack>

      {loading ? (
        <Center role="status" aria-label="Loading your collection" py="10">
          <Spinner />
        </Center>
      ) : failed ? (
        <Callout status="error">
          We couldn&rsquo;t load your collection. Please try again.
        </Callout>
      ) : (
        <PokemonList
          pokemon={shown}
          filtered={filtered}
          onEdit={setEditing}
          onDelete={setDeleting}
        />
      )}

      {editing && (
        <RegisterDialog
          key={editing.id}
          editing={editing}
          open
          onOpenChange={(next) => {
            if (!next) setEditing(null)
          }}
          onUpdated={(updated) =>
            setPokemon((prev) =>
              prev.map((p) => (p.id === updated.id ? updated : p)),
            )
          }
        />
      )}

      {deleting && (
        <Dialog
          role="alertdialog"
          open
          onOpenChange={(next) => {
            if (!next) {
              setDeleting(null)
              setDeleteFailed(false)
            }
          }}
          trigger={<span hidden aria-hidden="true" />}
          title="Delete this Pokémon?"
          footer={
            <Button colorPalette="red" onClick={confirmDelete}>
              Delete
            </Button>
          }
        >
          <Stack gap="3">
            {deleteFailed && (
              <Callout status="error">
                Could not delete — please try again.
              </Callout>
            )}
            <Text>
              Delete {displayName(deleting.species)}? This can&rsquo;t be
              undone.
            </Text>
          </Stack>
        </Dialog>
      )}
    </Stack>
  )
}
