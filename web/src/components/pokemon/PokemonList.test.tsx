import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { ThemeProvider } from '@rauboti/ui'
import { PokemonList } from './PokemonList'
import type { Pokemon, Species } from '@/api/schemas'

/**
 * Presentation of the collection grid (US2 additions): type badges per row, the FR-013 stale
 * "re-check" badge, and the two empty states — nothing registered vs. filters matching nothing.
 * Filtering and sorting are the pure `lib/` concern; this only renders what it is handed.
 */

const species = (over: Partial<Species> = {}): Species => ({
  id: 'VENUSAUR',
  dexNr: 3,
  name: 'Venusaur',
  form: null,
  types: ['Grass', 'Poison'],
  baseAtk: 198,
  baseDef: 189,
  baseSta: 190,
  imageUrl: null,
  shinyImageUrl: null,
  syncedAt: '2026-07-21T09:00:00Z',
  ...over,
})

let seq = 0
const mk = (over: Partial<Pokemon> = {}): Pokemon => ({
  id: `p${seq++}`,
  species: species(),
  ivAtk: 15,
  ivDef: 15,
  ivSta: 15,
  cp: 2000,
  flags: {
    shiny: false,
    shadow: false,
    lucky: false,
    purified: false,
    bestBuddy: false,
  },
  moves: { fast: null, charged1: null, charged2: null },
  derived: {
    level: 25,
    hp: 150,
    attack: 160,
    defense: 150,
    stamina: 150,
    ivPercent: 100,
    perfect: true,
    projections: [],
  },
  stale: false,
  caughtAt: '2026-07-10',
  createdAt: '2026-07-10T18:00:00Z',
  ...over,
})

const renderList = (props: Parameters<typeof PokemonList>[0]) =>
  render(
    <ThemeProvider>
      <MemoryRouter>
        <PokemonList {...props} />
      </MemoryRouter>
    </ThemeProvider>,
  )

describe('PokemonList', () => {
  it('renders a row with its type badges (icon accessible name = type)', () => {
    renderList({
      pokemon: [mk({ species: species({ types: ['Grass', 'Poison'] }) })],
    })
    expect(screen.getByRole('img', { name: 'Grass' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Poison' })).toBeInTheDocument()
  })

  it('links each row name to its detail page', () => {
    renderList({ pokemon: [mk({ id: 'abc' })] })
    expect(screen.getByRole('link', { name: /venusaur/i })).toHaveAttribute(
      'href',
      '/pokemon/abc',
    )
  })

  it('flags a stale row with a re-check badge', () => {
    renderList({ pokemon: [mk({ stale: true })] })
    expect(screen.getByText(/re-check/i)).toBeInTheDocument()
  })

  it('shows an icon for each active catch attribute (and none for the others)', () => {
    renderList({
      pokemon: [
        mk({
          flags: {
            shiny: true,
            shadow: false,
            lucky: true,
            purified: false,
            bestBuddy: false,
          },
        }),
      ],
    })
    expect(screen.getByRole('img', { name: 'Shiny' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Lucky' })).toBeInTheDocument()
    expect(
      screen.queryByRole('img', { name: 'Best Buddy' }),
    ).not.toBeInTheDocument()
  })

  it('shows a rarity icon from the species (and none for an ordinary species)', () => {
    renderList({
      pokemon: [mk({ species: species({ rarity: 'Legendary' }) })],
    })
    expect(screen.getByRole('img', { name: 'Legendary' })).toBeInTheDocument()
    expect(
      screen.queryByRole('img', { name: 'Mythic' }),
    ).not.toBeInTheDocument()
  })

  it('shows no rarity icon for an unmapped rarity', () => {
    renderList({
      pokemon: [mk({ species: species({ rarity: 'Ultra Beast' }) })],
    })
    expect(
      screen.queryByRole('img', { name: 'Ultra Beast' }),
    ).not.toBeInTheDocument()
  })

  it('shows four pink stars for a hundo (perfect IV)', () => {
    renderList({
      pokemon: [
        mk({ derived: { ...mk().derived, ivPercent: 100, perfect: true } }),
      ],
    })
    const rating = screen.getByLabelText('IV 100%')
    expect(rating.querySelectorAll('[data-star="pink"]')).toHaveLength(4)
    expect(rating.querySelectorAll('[data-star="yellow"]')).toHaveLength(0)
  })

  it('shows yellow stars by IV band for a non-perfect row', () => {
    renderList({
      pokemon: [
        mk({ derived: { ...mk().derived, ivPercent: 93.3, perfect: false } }),
      ],
    })
    const rating = screen.getByLabelText('IV 93.3%')
    // 93.3% → three yellow stars (75–99% band), no pink.
    expect(rating.querySelectorAll('[data-star="yellow"]')).toHaveLength(3)
    expect(rating.querySelectorAll('[data-star="pink"]')).toHaveLength(0)
  })

  it('scales the yellow-star count with the IV band', () => {
    renderList({
      pokemon: [
        mk({
          id: 'a',
          derived: { ...mk().derived, ivPercent: 40, perfect: false },
        }),
        mk({
          id: 'b',
          derived: { ...mk().derived, ivPercent: 60, perfect: false },
        }),
      ],
    })
    expect(
      screen.getByLabelText('IV 40%').querySelectorAll('[data-star="yellow"]'),
    ).toHaveLength(1)
    expect(
      screen.getByLabelText('IV 60%').querySelectorAll('[data-star="yellow"]'),
    ).toHaveLength(2)
  })

  it('shows no re-check badge on a fresh row', () => {
    renderList({ pokemon: [mk({ stale: false })] })
    expect(screen.queryByText(/re-check/i)).not.toBeInTheDocument()
  })

  it('shows the collection-empty state when there is nothing and no filters are active', () => {
    renderList({ pokemon: [] })
    expect(screen.getByText(/no pokémon registered yet/i)).toBeInTheDocument()
  })

  it('shows a no-matches state when active filters exclude everything', () => {
    renderList({ pokemon: [], filtered: true })
    expect(screen.getByText(/no pokémon match/i)).toBeInTheDocument()
    expect(screen.queryByText(/registered yet/i)).not.toBeInTheDocument()
  })
})
