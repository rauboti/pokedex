import { describe, expect, test, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { ThemeProvider } from '@rauboti/ui'
import { MovesPanel } from './MovesPanel'
import { server } from '@/mocks/server'
import type { Move, Pokemon, PokemonPatch } from '@/api/schemas'

/**
 * The detail-view moves panel. Two side-by-side type/move tables (Recommended vs Actual) with a
 * match/mismatch verdict and an explicit unrecorded state; a pencil opens a modal that edits the
 * set from the species pool (legacy marked "not currently obtainable"), with a 1-or-2 charged-slot
 * toggle. The pool comes from `GET /api/species/{id}/moves` (MSW-backed; Venusaur is seeded with
 * a legacy Frenzy Plant + a recommendation of Vine Whip + Frenzy Plant).
 */

const move = (
  id: string,
  name: string,
  type: string,
  fast: boolean,
  legacy = false,
): Move => ({ id, name, type, fast, ...(legacy ? { legacy } : {}) })

const venusaur = (moves: Pokemon['moves']): Pokemon => ({
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
    syncedAt: '2026-07-21T09:00:00Z',
  },
  ivAtk: 15,
  ivDef: 15,
  ivSta: 15,
  cp: 2087,
  flags: {
    shiny: false,
    shadow: false,
    lucky: false,
    purified: false,
    bestBuddy: false,
  },
  moves,
  derived: {
    level: 25,
    hp: 151,
    attack: 168,
    defense: 160,
    stamina: 161,
    ivPercent: 100,
    perfect: true,
    projections: [],
  },
  stale: false,
  caughtAt: null,
  createdAt: '2026-07-10T18:00:00Z',
})

const NONE: Pokemon['moves'] = { fast: null, charged1: null, charged2: null }
const RECOMMENDED: Pokemon['moves'] = {
  fast: move('VINE_WHIP_FAST', 'Vine Whip', 'Grass', true),
  charged1: move('FRENZY_PLANT', 'Frenzy Plant', 'Grass', false, true),
  charged2: null,
}

const renderPanel = (pokemon: Pokemon, onSaved = vi.fn()) => {
  render(
    <ThemeProvider>
      <MovesPanel pokemon={pokemon} onSaved={onSaved} />
    </ThemeProvider>,
  )
  return onSaved
}

const region = (name: string) => screen.getByRole('region', { name })

const openEditor = async () => {
  await userEvent.click(
    await screen.findByRole('button', { name: /edit moves/i }),
  )
  return screen.findByRole('dialog')
}

const openCombobox = async (root: HTMLElement, name: RegExp) => {
  await userEvent.click(within(root).getByRole('combobox', { name }))
  await userEvent.keyboard('{ArrowDown}') // click alone doesn't open the listbox
}

describe('MovesPanel — summary tables', () => {
  test('renders the recommended moveset in its own table, marking the legacy move', async () => {
    renderPanel(venusaur(NONE))
    const recommended = region('Recommended')
    expect(
      await within(recommended).findByText(/vine whip/i),
    ).toBeInTheDocument()
    expect(within(recommended).getByText(/frenzy plant/i)).toHaveTextContent(
      /not currently obtainable/i,
    )
  })

  test('renders the actual recorded moves in the Actual table', () => {
    renderPanel(venusaur(RECOMMENDED))
    const actual = region('Actual')
    expect(within(actual).getByText(/vine whip/i)).toBeInTheDocument()
    expect(within(actual).getByText(/frenzy plant/i)).toBeInTheDocument()
  })

  test('shows an explicit unrecorded state in the Actual table when nothing is recorded', () => {
    renderPanel(venusaur(NONE))
    expect(
      within(region('Actual')).getByText(/no moves recorded/i),
    ).toBeInTheDocument()
  })

  test('flags a match when the recorded set equals the recommendation', async () => {
    renderPanel(venusaur(RECOMMENDED))
    expect(
      await screen.findByText(/matches the recommendation/i),
    ).toBeInTheDocument()
  })

  test('flags a mismatch when the recorded set differs', async () => {
    renderPanel(
      venusaur({
        fast: move('RAZOR_LEAF_FAST', 'Razor Leaf', 'Grass', true),
        charged1: move('SLUDGE_BOMB', 'Sludge Bomb', 'Poison', false),
        charged2: null,
      }),
    )
    expect(
      await screen.findByText(/differs from the recommendation/i),
    ).toBeInTheDocument()
  })
})

describe('MovesPanel — edit modal', () => {
  test('the pencil opens a modal whose selects offer only the species pool', async () => {
    renderPanel(venusaur(NONE))
    const dialog = await openEditor()
    await openCombobox(dialog, /^fast move/i)
    const fastOptions = (await screen.findAllByRole('option')).map(
      (o) => o.textContent,
    )
    expect(fastOptions).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/vine whip/i),
        expect.stringMatching(/razor leaf/i),
      ]),
    )
    expect(fastOptions.some((t) => /sludge bomb/i.test(t ?? ''))).toBe(false)
  })

  test('a legacy move is marked "not currently obtainable" in the charged select', async () => {
    renderPanel(venusaur(NONE))
    const dialog = await openEditor()
    await openCombobox(dialog, /^charged move 1/i)
    expect(
      await screen.findByRole('option', { name: /frenzy plant/i }),
    ).toHaveTextContent(/not currently obtainable/i)
  })

  test('the charged-count segmented control reveals the second charged select on 2', async () => {
    renderPanel(venusaur(NONE))
    const dialog = await openEditor()
    expect(
      within(dialog).getByRole('combobox', { name: /charged move 1/i }),
    ).toBeInTheDocument()
    expect(
      within(dialog).queryByRole('combobox', { name: /charged move 2/i }),
    ).not.toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('radio', { name: '2' }))
    expect(
      within(dialog).getByRole('combobox', { name: /charged move 2/i }),
    ).toBeInTheDocument()
  })

  test('the selects are required, so no "(optional)" label appears', async () => {
    renderPanel(venusaur(NONE))
    const dialog = await openEditor()
    expect(within(dialog).queryByText(/optional/i)).not.toBeInTheDocument()
  })

  test('saving two charged moves PATCHes all three ids, reports the update, and closes', async () => {
    let body: PokemonPatch | undefined
    server.use(
      http.patch('/api/pokemon/:id', async ({ request }) => {
        body = (await request.json()) as PokemonPatch
        return HttpResponse.json(venusaur(RECOMMENDED))
      }),
    )
    const onSaved = renderPanel(venusaur(NONE))
    const dialog = await openEditor()

    await openCombobox(dialog, /^fast move/i)
    await userEvent.click(
      await screen.findByRole('option', { name: /vine whip/i }),
    )
    await openCombobox(dialog, /^charged move 1/i)
    await userEvent.click(
      await screen.findByRole('option', { name: /frenzy plant/i }),
    )
    await userEvent.click(within(dialog).getByRole('radio', { name: '2' }))
    await openCombobox(dialog, /^charged move 2/i)
    await userEvent.click(
      await screen.findByRole('option', { name: /power whip/i }),
    )

    await userEvent.click(
      within(dialog).getByRole('button', { name: /save moves/i }),
    )

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(body).toEqual({
      fastMoveId: 'VINE_WHIP_FAST',
      chargedMove1Id: 'FRENZY_PLANT',
      chargedMove2Id: 'POWER_WHIP',
    })
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
  })
})

describe('MovesPanel — pool load failure', () => {
  test('surfaces an error and offers no editor when the pool fetch fails', async () => {
    server.use(
      http.get('/api/species/:id/moves', () =>
        HttpResponse.json(
          { title: 'Not Found', status: 404, code: 'unknown-species' },
          {
            status: 404,
            headers: { 'Content-Type': 'application/problem+json' },
          },
        ),
      ),
    )
    renderPanel(venusaur(NONE))
    expect(
      await within(region('Moves')).findByText(
        /couldn.t load this species. move pool/i,
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /edit moves/i }),
    ).not.toBeInTheDocument()
  })
})
