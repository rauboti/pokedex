import { describe, expect, test, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { ThemeProvider } from '@rauboti/ui'
import { RegisterDialog } from './RegisterDialog'
import { server } from '@/mocks/server'
import { COLLISION_CP, IMPOSSIBLE_CP } from '@/mocks/fixtures'
import type { Pokemon, PokemonInput, PokemonPatch } from '@/api/schemas'

/**
 * The register dialog is the MVP write path (US1): search a species (forms + types), enter IVs + the
 * observed CP, preview the server-derived level/HP/stats/IV%, disambiguate a CP collision, reject an
 * impossible combination, set flags + catch date, and save a wire-shaped PokemonInput. Stat math is
 * never done here — the preview reads the derivation endpoint (research D7). MSW backs every call:
 * searchSpecies, derive (1/2/0 candidates by the CP sentinels), and the create store.
 */

const renderDialog = (
  props: Partial<Parameters<typeof RegisterDialog>[0]> = {},
) =>
  render(
    <ThemeProvider>
      <RegisterDialog {...props} />
    </ThemeProvider>,
  )

const openDialog = async () => {
  await userEvent.click(screen.getByRole('button', { name: /^register/i }))
  return screen.findByRole('dialog')
}

const pickSpecies = async (query: string, name: RegExp) => {
  await userEvent.type(screen.getByLabelText(/^species/i), query)
  await userEvent.click(await screen.findByRole('button', { name }))
}

const setIv = async (label: RegExp, value: number) => {
  const field = screen.getByLabelText(label)
  await userEvent.clear(field)
  await userEvent.type(field, String(value))
}

const setCp = async (value: number) => {
  const field = screen.getByLabelText(/^cp/i)
  await userEvent.clear(field)
  await userEvent.type(field, String(value))
}

// Select an option from the Flags combobox — the only combobox in these tests, so
// its chevron is the sole "Toggle options" control.
const chooseFlag = async (optionName: RegExp) => {
  await userEvent.click(screen.getByRole('button', { name: /toggle options/i }))
  await userEvent.click(await screen.findByRole('option', { name: optionName }))
}

describe('RegisterDialog', () => {
  test('searches species and lists forms with their types', async () => {
    renderDialog()
    await openDialog()

    await userEvent.type(screen.getByLabelText(/^species/i), 'rat')

    // A regional form is listed by name + form, with its types shown as icons (the type is the
    // icon's accessible name, so it folds into the option's accessible name).
    const option = await screen.findByRole('button', {
      name: /rattata.*alola/i,
    })
    expect(option).toHaveAccessibleName(/dark/i)
    expect(option).toHaveAccessibleName(/normal/i)
  })

  test('collapses to the selected species with its type badges, and Change reopens the search', async () => {
    renderDialog()
    await openDialog()

    await pickSpecies('venu', /venusaur/i)

    // The selection is now the value: name + type icons, and the search input is gone.
    expect(screen.getByText('Venusaur')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Grass' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Poison' })).toBeInTheDocument()
    expect(screen.queryByLabelText(/^species/i)).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /change/i }))
    expect(screen.getByLabelText(/^species/i)).toBeInTheDocument()
  })

  test('clamps IV inputs to 0–15 and requires CP ≥ 10', async () => {
    renderDialog()
    await openDialog()

    const atk = screen.getByLabelText(/attack iv/i)
    await userEvent.clear(atk)
    await userEvent.type(atk, '20')
    expect(atk).toHaveValue(15)

    expect(atk).toHaveAttribute('min', '0')
    expect(atk).toHaveAttribute('max', '15')
    expect(screen.getByLabelText(/^cp/i)).toHaveAttribute('min', '10')
  })

  test('previews the derived level, HP, stats and IV% on complete input', async () => {
    renderDialog()
    await openDialog()

    await pickSpecies('venu', /venusaur/i)
    await setIv(/attack iv/i, 15)
    await setIv(/defense iv/i, 15)
    await setIv(/stamina iv/i, 15)
    await setCp(2087)

    // Values come straight from the derivation endpoint (mock: level 20, hp 120, atk 130.5…).
    expect(await screen.findByText(/level 20\b/i)).toBeInTheDocument()
    // Effective stats render to 2 decimals (attack 130.5 → 130.50, stamina 150 → 150.00).
    expect(screen.getByText(/^attack 130\.50$/i)).toBeInTheDocument()
    expect(screen.getByText(/^stamina 150\.00$/i)).toBeInTheDocument()
    expect(screen.getByText(/^hp 120$/i)).toBeInTheDocument() // HP (no decimals)
    expect(screen.getByText(/100(\.0)?%/)).toBeInTheDocument() // IV%
    expect(screen.getByRole('button', { name: /^save/i })).toBeEnabled()
  })

  test('a CP collision shows a level picker with dust costs and blocks save until one is picked', async () => {
    renderDialog()
    await openDialog()

    await pickSpecies('venu', /venusaur/i)
    await setCp(COLLISION_CP)

    // The level combobox appears; save is blocked until a level is chosen.
    const levelInput = await screen.findByRole('combobox', { name: /^level$/i })
    expect(screen.getByRole('button', { name: /^save/i })).toBeDisabled()

    await userEvent.click(levelInput)
    await userEvent.keyboard('{ArrowDown}')
    const option18 = await screen.findByRole('option', { name: /level 18/i })
    expect(
      screen.getByRole('option', { name: /level 20/i }),
    ).toBeInTheDocument()
    // Dust cost rides along on each option as the disambiguating hint.
    expect(option18).toHaveTextContent(/stardust/i)

    await userEvent.click(option18)
    expect(screen.getByRole('button', { name: /^save/i })).toBeEnabled()
  })

  test('an impossible combination is explained and blocks save', async () => {
    renderDialog()
    await openDialog()

    await pickSpecies('venu', /venusaur/i)
    await setCp(IMPOSSIBLE_CP)

    expect(
      await screen.findByText(/no level (matches|yields)/i),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^save/i })).toBeDisabled()
  })

  test('the Best Buddy flag reveals the boosted-CP hint', async () => {
    renderDialog()
    await openDialog()

    expect(screen.queryByText(/boosted/i)).not.toBeInTheDocument()
    await chooseFlag(/best buddy/i)
    expect(screen.getByText(/boosted/i)).toBeInTheDocument()
  })

  test('saving posts a wire-shaped PokemonInput with the derived level and calls onCreated', async () => {
    let body: PokemonInput | undefined
    server.use(
      http.post('/api/pokemon', async ({ request }) => {
        body = (await request.json()) as PokemonInput
        return HttpResponse.json(
          {
            id: 'created-1',
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
            ivAtk: body.ivAtk,
            ivDef: body.ivDef,
            ivSta: body.ivSta,
            cp: body.cp,
            flags: {
              shiny: body.shiny ?? false,
              shadow: false,
              lucky: false,
              purified: false,
              bestBuddy: false,
            },
            moves: { fast: null, charged1: null, charged2: null },
            derived: {
              level: body.level ?? 20,
              hp: 120,
              attack: 130.5,
              defense: 120.4,
              stamina: 150,
              ivPercent: 100,
              perfect: true,
              projections: [],
            },
            stale: false,
            caughtAt: body.caughtAt ?? null,
            createdAt: '2026-07-21T12:00:00Z',
          },
          { status: 201 },
        )
      }),
    )
    const onCreated = vi.fn()
    renderDialog({ onCreated })
    await openDialog()

    await pickSpecies('venu', /venusaur/i)
    await setIv(/attack iv/i, 15)
    await setIv(/defense iv/i, 15)
    await setIv(/stamina iv/i, 15)
    await setCp(2087)

    await screen.findByText(/level 20\b/i) // preview settled → derivation confirmed
    await chooseFlag(/shiny/i)
    await userEvent.click(screen.getByRole('button', { name: /^save/i }))

    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1))
    expect(body).toMatchObject({
      speciesId: 'VENUSAUR',
      ivAtk: 15,
      ivDef: 15,
      ivSta: 15,
      cp: 2087,
      level: 20,
      shiny: true,
    })
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
  })
})

/**
 * Edit mode (US2): the same dialog, opened prefilled from an existing Pokémon and controlled by the
 * caller (the collection page opens it from a row). Changing IVs/CP re-runs the same derivation
 * preview, and saving PATCHes the edit instead of creating. Purification is just an ordinary edit
 * (change IVs/CP + set the purified flag) in one save (spec assumption).
 */
const makeVenusaur = (over: Partial<Pokemon> = {}): Pokemon => ({
  id: 'edit-1',
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
    level: 20,
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
  ...over,
})

const renderEdit = (
  editing: Pokemon,
  props: Partial<Parameters<typeof RegisterDialog>[0]> = {},
) =>
  render(
    <ThemeProvider>
      <RegisterDialog
        editing={editing}
        open
        onOpenChange={() => {}}
        {...props}
      />
    </ThemeProvider>,
  )

describe('RegisterDialog — edit mode', () => {
  test('opens prefilled from the Pokémon being edited', async () => {
    renderEdit(makeVenusaur())

    expect(await screen.findByText(/edit pokémon/i)).toBeInTheDocument()
    expect(screen.getByText('Venusaur')).toBeInTheDocument()
    expect(screen.getByLabelText(/attack iv/i)).toHaveValue(15)
    expect(screen.getByLabelText(/defense iv/i)).toHaveValue(14)
    expect(screen.getByLabelText(/stamina iv/i)).toHaveValue(13)
    expect(screen.getByLabelText(/^cp/i)).toHaveValue(2087)
  })

  test('re-runs the derivation on a CP change and PATCHes the edit', async () => {
    let body: PokemonPatch | undefined
    server.use(
      http.patch('/api/pokemon/:id', async ({ request }) => {
        body = (await request.json()) as PokemonPatch
        return HttpResponse.json({
          ...makeVenusaur(),
          cp: body.cp ?? 0,
          stale: false,
        })
      }),
    )
    const onUpdated = vi.fn()
    renderEdit(makeVenusaur(), { onUpdated })

    await screen.findByText(/level 20\b/i) // prefill derivation settled
    const cp = screen.getByLabelText(/^cp/i)
    await userEvent.clear(cp)
    await userEvent.type(cp, '2100')
    await screen.findByText(/level 20\b/i) // re-derivation settled

    await userEvent.click(screen.getByRole('button', { name: /^save/i }))

    await waitFor(() => expect(onUpdated).toHaveBeenCalledTimes(1))
    expect(body).toMatchObject({
      speciesId: 'VENUSAUR',
      cp: 2100,
      level: 20,
      ivAtk: 15,
    })
  })

  test('the purification walkthrough saves IV/CP edits and the purified flag in one PATCH', async () => {
    let body: PokemonPatch | undefined
    server.use(
      http.patch('/api/pokemon/:id', async ({ request }) => {
        body = (await request.json()) as PokemonPatch
        return HttpResponse.json({ ...makeVenusaur(), stale: false })
      }),
    )
    // A shadow Venusaur being purified: keep shadow, add purified, tweak an IV.
    renderEdit(
      makeVenusaur({
        flags: {
          shiny: false,
          shadow: true,
          lucky: false,
          purified: false,
          bestBuddy: false,
        },
      }),
    )
    await screen.findByText(/level 20\b/i)

    const atk = screen.getByLabelText(/attack iv/i)
    await userEvent.clear(atk)
    await userEvent.type(atk, '13')
    await userEvent.click(
      screen.getByRole('button', { name: /toggle options/i }),
    )
    await userEvent.click(
      await screen.findByRole('option', { name: /purified/i }),
    )
    await screen.findByText(/level 20\b/i)

    await userEvent.click(screen.getByRole('button', { name: /^save/i }))

    await waitFor(() => expect(body).toBeDefined())
    expect(body).toMatchObject({ purified: true, shadow: true, ivAtk: 13 })
  })

  test('a colliding CP shows the level picker on edit', async () => {
    renderEdit(
      makeVenusaur({
        cp: COLLISION_CP,
        derived: { ...makeVenusaur().derived, level: 18 },
      }),
    )
    expect(
      await screen.findByRole('combobox', { name: /^level$/i }),
    ).toBeInTheDocument()
  })
})
