import { Center, HStack, Stack, Text } from '@chakra-ui/react'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Grid,
  PencilIcon,
  TrashIcon,
} from '@rauboti/ui'
import type { Pokemon } from '@/api/schemas'
import { IvStars } from './IvStars'
import { PokemonAttributes } from './PokemonAttributes'
import { PokemonSprite } from './PokemonSprite'
import { TypeBadge } from './TypeBadge'

/**
 * The collection grid (US1/US2, FR-010). A responsive @rauboti/ui `Grid` of `Card`s — up to four
 * columns at the widest, reflowing to fewer as the viewport narrows; `autoFill` keeps empty tracks so
 * a lone card holds its column width instead of stretching. Each card is a vertical stack: **name +
 * types**, the centred **sprite** (larger on wide screens), the **CP** on its own, **HP · Level**, a
 * fixed-height **attributes** row ([PokemonAttributes] — Shiny/Shadow/Lucky/Best Buddy glyphs), then
 * **the IV star rating + the edit/delete actions** — all server-derived values read straight from the
 * DTO (the web app does no stat math, research D7). IV quality shows as a Pokémon GO-style star rating
 * ([IvStars] — yellow stars by band, one pink star for a perfect catch, US3) rather than a raw number.
 * A rebalanced (`stale`) row wears a "re-check" badge (FR-013) and its edit action reads "Re-enter".
 * Kept as a `ul`/`li` list for semantics; cards are presentational here (detail view lands US3, T025).
 *
 * When the list is empty it renders one of two empty states: `filtered` distinguishes "your filters
 * match nothing" from "you have registered nothing yet". `onEdit`/`onDelete` add per-card actions; a
 * stale row's edit is surfaced as a prominent "Re-enter" so the FR-013 re-check has an obvious path.
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
  /** True when a filter is active, so an empty result reads as "no matches" not "nothing yet". */
  filtered?: boolean
  /** Open the edit flow for a row (also the stale "re-enter" path). Omitted → no edit action. */
  onEdit?: (pokemon: Pokemon) => void
  /** Delete a row (the page confirms first). Omitted → no delete action. */
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
        <Card as="li" key={p.id}>
          <Stack gap="2">
            {/* Row 1: name (left) + types (right) */}
            <HStack justify="space-between" wrap="wrap" gap="2">
              <HStack gap="2" wrap="wrap" minW="0">
                <Text fontWeight="semibold">{displayName(p.species)}</Text>
                {p.stale && <Badge type="warning">Needs re-check</Badge>}
              </HStack>
              <HStack gap="1">
                {p.species.types.map((type) => (
                  <TypeBadge key={type} type={type} />
                ))}
              </HStack>
            </HStack>

            {/* Sprite, centred (larger on wide screens) */}
            <Center minH={{ base: '16', lg: '24' }}>
              <PokemonSprite pokemon={p} size={{ base: '16', lg: '24' }} />
            </Center>

            {/* CP alone, centred */}
            <Text textAlign="center" fontWeight="medium">
              CP {p.cp}
            </Text>

            <HStack justify="center" gap="4" color="text.muted" fontSize="sm">
              <Text>HP {p.derived.hp}</Text>
              <Text>Level {p.derived.level}</Text>
            </HStack>

            {/* Attributes (Shiny/Shadow/Lucky/Best Buddy) — fixed height, so cards align */}
            <PokemonAttributes flags={p.flags} rarity={p.species.rarity} />

            {/* IV star rating (left) + actions (right) */}
            <HStack justify="space-between" align="center">
              <IvStars
                ivPercent={p.derived.ivPercent}
                perfect={p.derived.perfect}
              />
              {(onEdit || onDelete) && (
                <HStack gap="1">
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
