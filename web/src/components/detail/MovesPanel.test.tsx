import { describe, expect, test, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { ThemeProvider } from '@rauboti/ui'
import { MovesPanel } from './MovesPanel'
import { server } from '@/mocks/server'
import type { Move, Pokemon, PokemonPatch } from '@/api/schemas'

/**
 * The detail-view moves panel: pick fast/charged moves from the species pool (legacy marked "not
 * currently obtainable"), compare the recorded set against the sync-recommended one, and save the edit.
 * The pool comes from `GET /api/species/{id}/moves` (MSW-backed; Venusaur is seeded with a legacy
 * Frenzy Plant + a recommendation). No moves recorded → an explicit unrecorded state, never a guessed
 * set.
 */

const move = (
  id: string,
  name: string,
  type: string,
  fast: boolean,
  legacy = false,
): Move => ({
  id,
  name,
  type,
  fast,
  ...(legacy ? { legacy } : {}),
})

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

const panel = () => screen.getByRole('region', { name: 'Moves' })
const openCombobox = async (name: RegExp) => {
  const input = within(panel()).getByRole('combobox', { name })
  await userEvent.click(input)
  await userEvent.keyboard('{ArrowDown}') // click alone doesn't open this combobox's listbox
  return input
}

describe('MovesPanel', () => {
  test('fast/charged selects offer only the species pool, split by kind', async () => {
    renderPanel(venusaur(NONE))
    await openCombobox(/^fast move/i)
    const fastOptions = (await screen.findAllByRole('option')).map(
      (o) => o.textContent,
    )
    expect(fastOptions).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/vine whip/i),
        expect.stringMatching(/razor leaf/i),
      ]),
    )
    // A charged move must never appear in the fast select.
    expect(fastOptions.some((t) => /sludge bomb/i.test(t ?? ''))).toBe(false)
  })

  test('a legacy move is marked "not currently obtainable" in the charged select', async () => {
    renderPanel(venusaur(NONE))
    await openCombobox(/^charged move/i)
    const frenzyPlant = await screen.findByRole('option', {
      name: /frenzy plant/i,
    })
    expect(frenzyPlant).toHaveTextContent(/not currently obtainable/i)
    // A non-legacy move carries no such marker.
    expect(
      screen.getByRole('option', { name: /power whip/i }),
    ).not.toHaveTextContent(/not currently obtainable/i)
  })

  test('shows an explicit unrecorded state and no match verdict when nothing is recorded', async () => {
    renderPanel(venusaur(NONE))
    expect(
      await within(panel()).findByText(/no moves recorded/i),
    ).toBeInTheDocument()
    expect(
      within(panel()).queryByText(/matches the recommendation/i),
    ).not.toBeInTheDocument()
    expect(
      within(panel()).queryByText(/differs from the recommendation/i),
    ).not.toBeInTheDocument()
  })

  test('renders recorded vs recommended and flags a match', async () => {
    renderPanel(venusaur(RECOMMENDED))
    // The recommendation (Vine Whip + Frenzy Plant) is shown alongside the recorded set.
    expect(
      await within(panel()).findByText(/recommended moveset/i),
    ).toBeInTheDocument()
    expect(
      within(panel()).getByText(/matches the recommendation/i),
    ).toBeInTheDocument()
  })

  test('flags a mismatch when the recorded set differs from the recommendation', async () => {
    renderPanel(
      venusaur({
        fast: move('RAZOR_LEAF_FAST', 'Razor Leaf', 'Grass', true),
        charged1: move('SLUDGE_BOMB', 'Sludge Bomb', 'Poison', false),
        charged2: null,
      }),
    )
    expect(
      await within(panel()).findByText(/differs from the recommendation/i),
    ).toBeInTheDocument()
  })

  test('a match counts the recommended charged move in either charged slot', async () => {
    // Recommended charged (Frenzy Plant) recorded in the SECOND slot still matches.
    renderPanel(
      venusaur({
        fast: move('VINE_WHIP_FAST', 'Vine Whip', 'Grass', true),
        charged1: move('SLUDGE_BOMB', 'Sludge Bomb', 'Poison', false),
        charged2: move('FRENZY_PLANT', 'Frenzy Plant', 'Grass', false, true),
      }),
    )
    expect(
      await within(panel()).findByText(/matches the recommendation/i),
    ).toBeInTheDocument()
  })

  test('saving PATCHes the selected move ids and reports the updated Pokémon', async () => {
    let body: PokemonPatch | undefined
    server.use(
      http.patch('/api/pokemon/:id', async ({ request }) => {
        body = (await request.json()) as PokemonPatch
        return HttpResponse.json(venusaur(RECOMMENDED))
      }),
    )
    const onSaved = renderPanel(venusaur(NONE))

    // Pick Vine Whip (fast) and Frenzy Plant (charged 1).
    await openCombobox(/^fast move/i)
    await userEvent.click(
      await screen.findByRole('option', { name: /vine whip/i }),
    )
    await openCombobox(/^charged move/i)
    await userEvent.click(
      await screen.findByRole('option', { name: /frenzy plant/i }),
    )

    await userEvent.click(
      within(panel()).getByRole('button', { name: /save moves/i }),
    )

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(body).toMatchObject({
      fastMoveId: 'VINE_WHIP_FAST',
      chargedMove1Id: 'FRENZY_PLANT',
    })
  })

  test('surfaces a load error instead of silently-empty selects when the pool fetch fails', async () => {
    // A missing moves endpoint / unsynced catalog must be visible, not look like "no moves exist".
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
      await within(panel()).findByText(
        /couldn.t load this species. move pool/i,
      ),
    ).toBeInTheDocument()
    expect(
      within(panel()).queryByRole('combobox', { name: /^fast move/i }),
    ).not.toBeInTheDocument()
  })

  test('the second charged slot is optional — it renders and is not required', async () => {
    renderPanel(venusaur(NONE))
    const second = await within(panel()).findByRole('combobox', {
      name: /second charged move/i,
    })
    expect(second).not.toBeRequired()
  })
})
