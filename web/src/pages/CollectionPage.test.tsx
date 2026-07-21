import { describe, expect, test } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse, delay } from 'msw'
import { ThemeProvider } from '@rauboti/ui'
import { CollectionPage } from './CollectionPage'
import { server } from '@/mocks/server'
import type { Pokemon } from '@/api/schemas'

/**
 * The collection landing page (US1, FR-010 web): lists the caller's Pokémon with the server-derived
 * values shown straight from the DTO (no client stat math), a Register trigger that adds a row on
 * success, a catalog-freshness line, and loading/error states. Every call is MSW-backed.
 */

const renderPage = () =>
  render(
    <ThemeProvider>
      <CollectionPage />
    </ThemeProvider>,
  )

const makePokemon = (overrides: Partial<Pokemon> = {}): Pokemon => ({
  id: 'p1',
  species: {
    id: 'RATTATA_ALOLA',
    dexNr: 19,
    name: 'Rattata',
    form: 'Alola',
    types: ['Dark', 'Normal'],
    baseAtk: 103,
    baseDef: 70,
    baseSta: 102,
    imageUrl: 'https://example.test/RATTATA_ALOLA.png',
    shinyImageUrl: 'https://example.test/RATTATA_ALOLA.s.png',
    syncedAt: '2026-07-21T09:00:00Z',
  },
  ivAtk: 15,
  ivDef: 14,
  ivSta: 13,
  cp: 844,
  flags: {
    shiny: true,
    shadow: false,
    lucky: false,
    purified: false,
    bestBuddy: false,
  },
  moves: { fast: null, charged1: null, charged2: null },
  derived: {
    level: 25,
    hp: 120,
    attack: 130.5,
    defense: 120.4,
    stamina: 150,
    ivPercent: 93.3,
    perfect: false,
    projections: [],
  },
  stale: false,
  caughtAt: '2026-07-10',
  createdAt: '2026-07-10T18:00:00Z',
  ...overrides,
})

describe('CollectionPage', () => {
  test('renders each Pokémon from the DTO — name/form, level, CP, IV%, types, flags', async () => {
    server.use(
      http.get('/api/pokemon', () => HttpResponse.json([makePokemon()])),
    )

    renderPage()

    expect(await screen.findByText(/Rattata \(Alola\)/i)).toBeInTheDocument()
    expect(screen.getByText(/level 25\b/i)).toBeInTheDocument()
    expect(screen.getByText(/\bCP 844\b/i)).toBeInTheDocument()
    expect(screen.getByText(/93\.3%/)).toBeInTheDocument()
    expect(screen.getByText('Dark')).toBeInTheDocument()
    expect(screen.getByText('Normal')).toBeInTheDocument()
    expect(screen.getByText('Shiny')).toBeInTheDocument()
  })

  test('shows the species sprite, using the shiny image for a shiny catch', async () => {
    // makePokemon() is a shiny Alolan Rattata with both image URLs set.
    server.use(
      http.get('/api/pokemon', () => HttpResponse.json([makePokemon()])),
    )

    renderPage()

    const sprite = await screen.findByRole('img', {
      name: /Rattata \(Alola\)/i,
    })
    expect(sprite).toHaveAttribute(
      'src',
      'https://example.test/RATTATA_ALOLA.s.png',
    )
  })

  test('falls back to no sprite when the species has no image', async () => {
    server.use(
      http.get('/api/pokemon', () =>
        HttpResponse.json([
          makePokemon({
            species: {
              id: 'NOIMG',
              dexNr: 1,
              name: 'Missingno',
              form: null,
              types: ['Normal'],
              baseAtk: 1,
              baseDef: 1,
              baseSta: 1,
              imageUrl: null,
              shinyImageUrl: null,
              syncedAt: '2026-07-21T09:00:00Z',
            },
          }),
        ]),
      ),
    )

    renderPage()

    expect(await screen.findByText('Missingno')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  test('shows an empty state when the collection has no Pokémon', async () => {
    server.use(http.get('/api/pokemon', () => HttpResponse.json([])))

    renderPage()

    expect(
      await screen.findByText(/no pokémon registered yet/i),
    ).toBeInTheDocument()
  })

  test('a register round-trip adds a row', async () => {
    server.use(http.get('/api/pokemon', () => HttpResponse.json([])))

    renderPage()
    await screen.findByText(/no pokémon registered yet/i)

    await userEvent.click(screen.getByRole('button', { name: /^register/i }))
    await userEvent.type(screen.getByLabelText(/^species/i), 'venu')
    await userEvent.click(
      await screen.findByRole('button', { name: /venusaur/i }),
    )
    const cp = screen.getByLabelText(/^cp/i)
    await userEvent.clear(cp)
    await userEvent.type(cp, '2087')
    await screen.findByText(/level 20\b/i) // derivation preview settled
    await userEvent.click(screen.getByRole('button', { name: /^save/i }))

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    expect(await screen.findByText(/venusaur/i)).toBeInTheDocument()
  })

  test('shows a loading indicator while the collection is in flight', async () => {
    server.use(
      http.get('/api/pokemon', async () => {
        await delay('infinite')
        return HttpResponse.json([])
      }),
    )

    renderPage()

    expect(
      await screen.findByRole('status', { name: /loading your collection/i }),
    ).toBeInTheDocument()
  })

  test('shows a Callout when the collection fails to load', async () => {
    server.use(
      http.get('/api/pokemon', () => new HttpResponse(null, { status: 500 })),
    )

    renderPage()

    expect(
      await screen.findByText(/couldn.?t load your collection/i),
    ).toBeInTheDocument()
  })

  test('shows the catalog freshness once synced', async () => {
    server.use(http.get('/api/pokemon', () => HttpResponse.json([])))

    renderPage()

    expect(await screen.findByText(/catalog synced/i)).toBeInTheDocument()
  })

  test('shows a not-synced-yet freshness state before the first sync', async () => {
    server.use(
      http.get('/api/pokemon', () => HttpResponse.json([])),
      http.get('/api/catalog', () =>
        HttpResponse.json({
          speciesCount: 0,
          moveCount: 0,
          syncedAt: null,
          stalePokemonCount: 0,
        }),
      ),
    )

    renderPage()

    expect(await screen.findByText(/not synced yet/i)).toBeInTheDocument()
  })
})
