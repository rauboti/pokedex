import {
  Center,
  HStack,
  Link as ChakraLink,
  Stack,
  Text,
} from '@chakra-ui/react'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Grid,
  PencilIcon,
  TrashIcon,
} from '@rauboti/ui'
import { Link as RouterLink } from 'react-router'
import type { Pokemon } from '@/api/schemas'
import { IvStars } from './IvStars'
import { PokemonAttributes } from './PokemonAttributes'
import { PokemonSprite } from './PokemonSprite'
import { TypeBadge } from './TypeBadge'

/**
 * The responsive collection grid of cards — layout and card anatomy are described in the web README
 * ("Registration and the collection view").
 *
 * The card uses a **stretched link**: the name is the real focusable anchor and its `::after` overlays
 * the card, so a click anywhere navigates. The edit/delete actions must therefore stay raised above
 * that overlay (`zIndex`) or they stop working. `autoFill` keeps empty tracks so a lone card holds its
 * column width instead of stretching.
 */

const displayName = (species: Pokemon['species']) =>
  species.form ? `${species.name} (${species.form})` : species.name

export const PokemonList = ({
  pokemon,
  filtered = false,
  onEdit,
  onDelete,
}: {
  pokemon: Pokemon[]
  /** Picks between the "no matches" and "nothing yet" empty states. */
  filtered?: boolean
  /** Also the stale "re-enter" path. Omitted → no edit action. */
  onEdit?: (pokemon: Pokemon) => void
  /** The page confirms first. Omitted → no delete action. */
  onDelete?: (pokemon: Pokemon) => void
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
    <Grid as="ul" autoFill minChildWidth="13rem">
      {pokemon.map((p) => (
        <Card as="li" key={p.id} interactive position="relative">
          <Stack gap="2">
            <HStack justify="space-between" wrap="wrap" gap="2">
              <HStack gap="2" wrap="wrap" minW="0">
                <ChakraLink
                  asChild
                  fontWeight="semibold"
                  _hover={{ textDecoration: 'underline' }}
                  _after={{ content: '""', position: 'absolute', inset: 0 }}
                >
                  <RouterLink to={`/pokemon/${p.id}`}>
                    {displayName(p.species)}
                  </RouterLink>
                </ChakraLink>
                {p.stale && <Badge type="warning">Needs re-check</Badge>}
              </HStack>
              <HStack gap="1">
                {p.species.types.map((type) => (
                  <TypeBadge key={type} type={type} />
                ))}
              </HStack>
            </HStack>

            <Center minH={{ base: '16', lg: '24' }}>
              <PokemonSprite pokemon={p} size={{ base: '16', lg: '24' }} />
            </Center>

            <Text textAlign="center" fontWeight="medium">
              CP {p.cp}
            </Text>

            <HStack justify="center" gap="4" color="text.muted" fontSize="sm">
              <Text>HP {p.derived.hp}</Text>
              <Text>Level {p.derived.level}</Text>
            </HStack>

            {/* Fixed height even when empty, so cards stay aligned */}
            <PokemonAttributes flags={p.flags} rarity={p.species.rarity} />

            <HStack justify="space-between" align="center">
              <IvStars
                ivPercent={p.derived.ivPercent}
                perfect={p.derived.perfect}
              />
              {(onEdit || onDelete) && (
                <HStack gap="1" position="relative" zIndex="1">
                  {onEdit && (
                    <Button
                      size="sm"
                      variant={p.stale ? 'solid' : 'ghost'}
                      colorPalette={p.stale ? 'orange' : undefined}
                      aria-label={p.stale ? 'Re-enter' : 'Edit'}
                      onClick={() => onEdit(p)}
                    >
                      <PencilIcon size={16} />
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="Delete"
                      onClick={() => onDelete(p)}
                    >
                      <TrashIcon size={16} />
                    </Button>
                  )}
                </HStack>
              )}
            </HStack>
          </Stack>
        </Card>
      ))}
    </Grid>
  )
}
