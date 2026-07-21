import { useEffect, useState } from 'react'
import { Box, HStack, Stack, Text } from '@chakra-ui/react'
import { Badge, Button, Input } from '@rauboti/ui'
import { searchSpecies, type Species } from '@/api/schemas'

/**
 * Species autocomplete for the register/edit dialog (US1). Types into `GET /api/species` (registrable
 * species only — mega/temporary forms are excluded server-side) and lists the matches with their
 * form and type badges, so a player disambiguates e.g. Alolan vs Kantonian Rattata before entering
 * IVs. In-flight requests are abandoned when the query changes (an AbortController plus a liveness
 * guard) so the last keystroke wins. Each result is a ghost [Button] (the library's subtle
 * clickable-row idiom); selecting one hands the full [Species] up and collapses the list.
 */

const displayName = (s: Species) => (s.form ? `${s.name} (${s.form})` : s.name)

export const SpeciesSearch = ({
  onSelect,
}: {
  onSelect: (species: Species) => void
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
    setQuery(displayName(species))
    setShowResults(false)
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
              <HStack gap="1">
                {species.types.map((type) => (
                  <Badge key={type}>{type}</Badge>
                ))}
              </HStack>
            </Button>
          ))}
        </Stack>
      )}
    </Box>
  )
}
