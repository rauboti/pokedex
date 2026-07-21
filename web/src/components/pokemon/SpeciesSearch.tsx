import { useEffect, useState } from 'react'
import { Box, HStack, Stack, Text } from '@chakra-ui/react'
import { Button, Input } from '@rauboti/ui'
import { searchSpecies, type Species } from '@/api/schemas'
import { TypeBadge } from './TypeBadge'

/**
 * Species picker for the register/edit dialog (US1). While no species is chosen it's a search: type
 * into `GET /api/species` (registrable species only) and pick from the matches, each showing its
 * form and type icons. In-flight requests are abandoned when the query changes (an AbortController +
 * liveness guard) so the last keystroke wins. Once chosen, it collapses to a **selected-value chip**
 * — the species name with its type badges inline — plus a Change action that reopens the search.
 */

const displayName = (s: Species) => (s.form ? `${s.name} (${s.form})` : s.name)

export const SpeciesSearch = ({
  selected,
  onSelect,
  onClear,
}: {
  selected: Species | null
  onSelect: (species: Species) => void
  onClear: () => void
}) => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Species[]>([])
  const [showResults, setShowResults] = useState(false)

  useEffect(() => {
    const q = query.trim()
    if (!q) return
    let active = true
    const controller = new AbortController()
    searchSpecies(q, 20, controller.signal)
      .then((found) => {
        if (active) setResults(found)
      })
      .catch(() => {
        // Aborted or transient — leave the field usable; the next keystroke retries.
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [query])

  const choose = (species: Species) => {
    onSelect(species)
    setQuery('')
    setShowResults(false)
  }

  // Selected state: the chosen species is the value — name + its type badges — with a Change action.
  if (selected) {
    return (
      <Box>
        <Text fontSize="sm" fontWeight="medium" mb="1">
          Species
        </Text>
        <HStack
          justify="space-between"
          gap="3"
          borderWidth="1px"
          borderColor="border"
          rounded="md"
          px="3"
          py="2"
        >
          <HStack gap="2" minW="0">
            <Text fontWeight="medium">{displayName(selected)}</Text>
            {selected.types.map((type) => (
              <TypeBadge key={type} type={type} />
            ))}
          </HStack>
          <Button type="button" variant="ghost" size="sm" onClick={onClear}>
            Change
          </Button>
        </HStack>
      </Box>
    )
  }

  return (
    <Box position="relative">
      <Input
        label="Species"
        required
        placeholder="Search by name…"
        autoComplete="off"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setShowResults(true)
        }}
      />
      {showResults && query.trim() !== '' && results.length > 0 && (
        <Stack gap="1" mt="2">
          {results.map((species) => (
            // `type="button"` so a result click selects rather than submitting the enclosing form.
            <Button
              key={species.id}
              type="button"
              variant="ghost"
              width="full"
              justifyContent="space-between"
              height="auto"
              py="2"
              onClick={() => choose(species)}
            >
              <Text fontWeight="medium">{displayName(species)}</Text>
              <HStack gap="2">
                {species.types.map((type) => (
                  <TypeBadge key={type} type={type} />
                ))}
              </HStack>
            </Button>
          ))}
        </Stack>
      )}
    </Box>
  )
}
