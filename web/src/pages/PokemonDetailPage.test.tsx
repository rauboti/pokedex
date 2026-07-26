import { describe, expect, test, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse, delay } from 'msw'
import {
  createMemoryRouter,
  RouterProvider,
  type RouteObject,
} from 'react-router'
import { ThemeProvider } from '@rauboti/ui'
import { PokemonDetailPage } from './PokemonDetailPage'
import { PokemonList } from '@/components/pokemon/PokemonList'
import { server } from '@/mocks/server'
import type { Pokemon, Projection } from '@/api/schemas'

/**
 * The Pokémon detail page (`/pokemon/:id`, US3): refetches the Pokémon by id and frames its
 * server-derived stats + level projections. An unknown id resolves to a not-found state; a
 * collection row links here. Every call is MSW-backed. The Highcharts IV gauges can't lay out in
 * jsdom, so the chart wrapper is stubbed; the projections table is a plain table and renders as-is.
 */

vi.mock('highcharts-react-official', () => ({ HighchartsReact: () => null }))

const projections: Projection[] = [
  {
    label: 'L40',
    level: 40,
    cp: 3000,
    hp: 150,
    attack: 180,
    defense: 170,
    stamina: 175,
  },
  {
    label: 'L50',
    level: 50,
    cp: 3400,
    hp: 165,
    attack: 195,
    defense: 185,
    stamina: 190,
  },
]

const venusaur = (over: Partial<Pokemon> = {}): Pokemon => ({
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
  ivAtk: 15,
  ivDef: 14,
  ivSta: 13,
  cp: 2087,
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
    hp: 123,
    attack: 160.4,
    defense: 140.2,
    stamina: 155.7,
    ivPercent: 93.3,
    perfect: false,
    projections,
  },
  stale: false,
  caughtAt: null,
  createdAt: '2026-07-10T18:00:00Z',
  ...over,
})

const renderAt = (path: string, extraRoutes: RouteObject[] = []) => {
  const router = createMemoryRouter(
    [{ path: '/pokemon/:id', element: <PokemonDetailPage /> }, ...extraRoutes],
    { initialEntries: [path] },
  )
  render(
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>,
  )
}

describe('PokemonDetailPage', () => {
  test('fetches the Pokémon by id and shows its stats and projections', async () => {
    server.use(
      http.get('/api/pokemon/:id', () => HttpResponse.json(venusaur())),
    )

    renderAt('/pokemon/venu')

    expect(
      await screen.findByRole('heading', { name: /venusaur/i }),
    ).toBeInTheDocument()
    const stats = screen.getByRole('region', { name: 'Stats' })
    expect(within(stats).getByText('25')).toBeInTheDocument() // level
    expect(within(stats).getByText('2087')).toBeInTheDocument() // CP
    const proj = screen.getByRole('region', { name: 'Projections' })
    expect(within(proj).getByText('L40')).toBeInTheDocument()
    expect(within(proj).getByText('L50')).toBeInTheDocument()
  })

  test('renders the Best Buddy projection row for a Best-Buddy Pokémon', async () => {
    server.use(
      http.get('/api/pokemon/:id', () =>
        HttpResponse.json(
          venusaur({
            flags: {
              shiny: false,
              shadow: false,
              lucky: false,
              purified: false,
              bestBuddy: true,
            },
            derived: {
              ...venusaur().derived,
              projections: [
                ...projections,
                {
                  label: 'BEST_BUDDY',
                  level: 26,
                  cp: 2200,
                  hp: 130,
                  attack: 150,
                  defense: 145,
                  stamina: 152,
                },
              ],
            },
          }),
        ),
      ),
    )

    renderAt('/pokemon/venu')

    const proj = await screen.findByRole('region', { name: 'Projections' })
    expect(within(proj).getByText('Best Buddy')).toBeInTheDocument()
  })

  test('shows a not-found state for an unknown id', async () => {
    server.use(
      http.get('/api/pokemon/:id', () =>
        HttpResponse.json(
          { title: 'Not Found', status: 404, code: 'pokemon-not-found' },
          {
            status: 404,
            headers: { 'Content-Type': 'application/problem+json' },
          },
        ),
      ),
    )

    renderAt('/pokemon/nope')

    expect(await screen.findByText(/not found/i)).toBeInTheDocument()
    expect(
      screen.queryByRole('region', { name: 'Stats' }),
    ).not.toBeInTheDocument()
  })

  test('shows a loading state while the fetch is in flight', async () => {
    server.use(
      http.get('/api/pokemon/:id', async () => {
        await delay('infinite')
        return HttpResponse.json(venusaur())
      }),
    )

    renderAt('/pokemon/venu')

    expect(
      await screen.findByRole('status', { name: /loading/i }),
    ).toBeInTheDocument()
  })

  test('navigates from a collection row to its detail page', async () => {
    server.use(
      http.get('/api/pokemon/:id', () => HttpResponse.json(venusaur())),
    )

    const router = createMemoryRouter(
      [
        { path: '/', element: <PokemonList pokemon={[venusaur()]} /> },
        { path: '/pokemon/:id', element: <PokemonDetailPage /> },
      ],
      { initialEntries: ['/'] },
    )
    render(
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>,
    )

    await userEvent.click(
      await screen.findByRole('link', { name: /venusaur/i }),
    )

    expect(
      await screen.findByRole('heading', { name: /venusaur/i }),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByRole('region', { name: 'Stats' })).toBeInTheDocument(),
    )
  })
})
