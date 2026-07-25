import { describe, expect, test } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse, delay } from 'msw'
import { ThemeProvider } from '@rauboti/ui'
import { CollectionPage } from './CollectionPage'
import { server } from '@/mocks/server'
import { filterPokemon } from '@/lib/filterPokemon'
import { sortPokemon } from '@/lib/sortPokemon'
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
    // Types are icon-only badges — their accessible name is the type.
    expect(screen.getByRole('img', { name: 'Dark' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Normal' })).toBeInTheDocument()
    // The flag badge lives on the card (scoped, so it isn't confused with the filter bar's flag option).
    expect(
      within(screen.getByRole('listitem')).getByText('Shiny'),
    ).toBeInTheDocument()
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
    // No sprite for this species — the type icon may still render, so scope to the sprite's name.
    expect(
      screen.queryByRole('img', { name: 'Missingno' }),
    ).not.toBeInTheDocument()
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

/**
 * US2 collection management: filter/sort the full collection client-side (the pure `lib/` functions),
 * edit a row through the prefilled dialog, and delete with a confirmation. Stale rows offer a
 * "re-enter" shortcut into the same edit flow that clears the badge on save.
 */
const makeVenusaur = (overrides: Partial<Pokemon> = {}): Pokemon =>
  makePokemon({
    id: 'venu',
    species: {
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
    },
    cp: 2087,
    ...overrides,
  })

describe('CollectionPage — US2 filter / sort / edit / delete', () => {
  test('filters the collection by species name', async () => {
    server.use(
      http.get('/api/pokemon', () =>
        HttpResponse.json([makePokemon({ id: 'r' }), makeVenusaur()]),
      ),
    )
    renderPage()
    await screen.findByText(/Rattata \(Alola\)/i)

    await userEvent.click(screen.getByRole('button', { name: 'Search' }))
    await userEvent.type(
      await screen.findByRole('textbox', { name: /search/i }),
      'venu',
    )

    expect(screen.getByText('Venusaur')).toBeInTheDocument()
    expect(screen.queryByText(/Rattata \(Alola\)/i)).not.toBeInTheDocument()
  })

  test('sorts by CP descending', async () => {
    server.use(
      http.get('/api/pokemon', () =>
        HttpResponse.json([
          makePokemon({ id: 'low', cp: 500 }),
          makeVenusaur({ id: 'high', cp: 3000 }),
        ]),
      ),
    )
    renderPage()
    await screen.findByText('Venusaur')

    await userEvent.click(screen.getByRole('button', { name: 'Sort' }))
    await userEvent.click(
      await screen.findByRole('combobox', { name: /sort by/i }),
    )
    await userEvent.keyboard('{ArrowDown}')
    await userEvent.click(
      await screen.findByRole('option', { name: 'CP Desc' }),
    )

    const rows = screen.getAllByRole('listitem')
    expect(rows[0]).toHaveTextContent('Venusaur')
    expect(rows[1]).toHaveTextContent('Rattata')
  })

  test('shows a no-matches state when filters exclude everything', async () => {
    server.use(
      http.get('/api/pokemon', () => HttpResponse.json([makePokemon()])),
    )
    renderPage()
    await screen.findByText(/Rattata \(Alola\)/i)

    await userEvent.click(screen.getByRole('button', { name: 'Search' }))
    await userEvent.type(
      await screen.findByRole('textbox', { name: /search/i }),
      'zzz',
    )
    expect(await screen.findByText(/no pokémon match/i)).toBeInTheDocument()
    expect(screen.queryByText(/registered yet/i)).not.toBeInTheDocument()
  })

  test('edits a Pokémon from its card and reflects the new CP', async () => {
    let patched: Pokemon | undefined
    server.use(
      http.get('/api/pokemon', () =>
        HttpResponse.json([makeVenusaur({ id: 'venu', cp: 2087 })]),
      ),
      http.patch('/api/pokemon/:id', async ({ request }) => {
        const body = (await request.json()) as { cp: number }
        patched = makeVenusaur({ id: 'venu', cp: body.cp })
        return HttpResponse.json(patched)
      }),
    )
    renderPage()
    await screen.findByText('Venusaur')

    await userEvent.click(screen.getByRole('button', { name: /^edit/i }))
    await screen.findByRole('dialog')
    expect(screen.getByLabelText(/^cp/i)).toHaveValue(2087)

    const cp = screen.getByLabelText(/^cp/i)
    await userEvent.clear(cp)
    await userEvent.type(cp, '900')
    await screen.findByText(/level 20\b/i)
    await userEvent.click(screen.getByRole('button', { name: /^save/i }))

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    expect(await screen.findByText(/\bCP 900\b/)).toBeInTheDocument()
  })

  test('deletes a Pokémon after a confirmation', async () => {
    server.use(
      http.get('/api/pokemon', () =>
        HttpResponse.json([makeVenusaur({ id: 'venu' })]),
      ),
      http.delete(
        '/api/pokemon/:id',
        () => new HttpResponse(null, { status: 204 }),
      ),
    )
    renderPage()
    await screen.findByText('Venusaur')

    await userEvent.click(screen.getByRole('button', { name: /^delete/i }))
    const confirm = await screen.findByRole('alertdialog')
    await userEvent.click(
      within(confirm).getByRole('button', { name: /^delete/i }),
    )

    await waitFor(() =>
      expect(screen.queryByText('Venusaur')).not.toBeInTheDocument(),
    )
  })

  test('a stale row offers re-enter, which opens the edit flow and clears the badge on save', async () => {
    server.use(
      http.get('/api/pokemon', () =>
        HttpResponse.json([makeVenusaur({ id: 'venu', stale: true })]),
      ),
      http.patch('/api/pokemon/:id', () =>
        HttpResponse.json(makeVenusaur({ id: 'venu', stale: false })),
      ),
    )
    renderPage()
    await screen.findByText(/needs re-check/i)

    await userEvent.click(screen.getByRole('button', { name: /re-enter/i }))
    await screen.findByRole('dialog')
    await screen.findByText(/level 20\b/i) // prefilled derivation settled → save enabled
    await userEvent.click(screen.getByRole('button', { name: /^save/i }))

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    expect(screen.queryByText(/needs re-check/i)).not.toBeInTheDocument()
  })

  test('SC-003: filtering and sorting 1,000 rows completes well under a second', () => {
    const big = Array.from({ length: 1000 }, (_, i) =>
      makePokemon({ id: `p${i}`, cp: (i * 7) % 3000 }),
    )
    const start = performance.now()
    const out = sortPokemon(filterPokemon(big, { species: 'rat' }), {
      key: 'cp',
      direction: 'desc',
    })
    const elapsed = performance.now() - start

    expect(out).toHaveLength(1000) // every row is an Alolan Rattata
    expect(elapsed).toBeLessThan(1000)
  })
})
