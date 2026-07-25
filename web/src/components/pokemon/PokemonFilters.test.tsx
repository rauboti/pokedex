import { describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@rauboti/ui'
import { PokemonFilters, type PokemonFiltersValue } from './PokemonFilters'

/**
 * The collection filter/sort bar (US2). A controlled component: it renders the current filter + sort
 * and emits the next value on every change. Filtering/sorting is applied elsewhere (the `lib/` pure
 * functions from T021, wired into the page in T023) — here we only assert the control surface and the
 * state it emits.
 */

const INITIAL: PokemonFiltersValue = {
  filter: {},
  sort: { key: 'name', direction: 'asc' },
}

const renderFilters = (initial: PokemonFiltersValue = INITIAL) => {
  const onState = vi.fn()
  const Harness = () => {
    const [value, setValue] = useState<PokemonFiltersValue>(initial)
    return (
      <PokemonFilters
        value={value}
        onChange={(next) => {
          setValue(next)
          onState(next)
        }}
      />
    )
  }
  render(
    <ThemeProvider>
      <Harness />
    </ThemeProvider>,
  )
  const latest = () =>
    onState.mock.calls.at(-1)?.[0] as PokemonFiltersValue | undefined
  return { latest }
}

// Open a single-select combobox by its field label and reveal its options.
const openCombobox = async (name: RegExp) => {
  await userEvent.click(screen.getByRole('combobox', { name }))
  await userEvent.keyboard('{ArrowDown}')
}

describe('PokemonFilters', () => {
  it('emits the species substring as it is typed', async () => {
    const { latest } = renderFilters()
    await userEvent.type(screen.getByLabelText(/^species/i), 'char')
    expect(latest()?.filter.species).toBe('char')
  })

  it('offers all 18 types and emits the chosen one', async () => {
    const { latest } = renderFilters()
    await openCombobox(/^type/i)
    expect(
      await screen.findByRole('option', { name: 'Grass' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Fire' })).toBeInTheDocument()
    expect(screen.getAllByRole('option')).toHaveLength(18)
    await userEvent.click(screen.getByRole('option', { name: 'Grass' }))
    expect(latest()?.filter.type).toBe('Grass')
  })

  it('emits the set of selected flags', async () => {
    const { latest } = renderFilters()
    await openCombobox(/^flags/i)
    await userEvent.click(await screen.findByRole('option', { name: 'Shiny' }))
    await openCombobox(/^flags/i)
    await userEvent.click(await screen.findByRole('option', { name: 'Lucky' }))
    expect(latest()?.filter.flags).toEqual(
      expect.arrayContaining(['shiny', 'lucky']),
    )
    expect(latest()?.filter.flags).toHaveLength(2)
  })

  it('emits the sort key and direction', async () => {
    const { latest } = renderFilters()
    await openCombobox(/sort by/i)
    await userEvent.click(await screen.findByRole('option', { name: 'CP' }))
    expect(latest()?.sort.key).toBe('cp')

    await userEvent.click(screen.getByRole('radio', { name: /desc/i }))
    expect(latest()?.sort.direction).toBe('desc')
  })

  it('shows the active filters', () => {
    renderFilters({
      filter: { species: 'Venu', type: 'Grass', flags: ['shiny'] },
      sort: { key: 'cp', direction: 'desc' },
    })
    expect(screen.getByLabelText(/^species/i)).toHaveValue('Venu')
    // The selected flag surfaces as a removable tag — i.e. a "Shiny" outside the (hidden) option list.
    const shinyTag = screen
      .getAllByText('Shiny')
      .find((el) => !el.closest('[role="option"]'))
    expect(shinyTag).toBeDefined()
  })
})
