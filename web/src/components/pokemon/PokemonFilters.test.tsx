import { describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@rauboti/ui'
import {
  PokemonFilters,
  PokemonFilterSummary,
  type PokemonFiltersValue,
} from './PokemonFilters'

/**
 * The search / filter / sort toolbar (US2): three icon buttons, each opening a popover with its
 * control. Controlled — it emits the next {filter, sort} on every change; the page applies it with the
 * pure `lib/` functions. Here we only assert the control surface, the emitted state, and the summary.
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

const renderSummary = (initial: PokemonFiltersValue) => {
  const Harness = () => {
    const [value, setValue] = useState<PokemonFiltersValue>(initial)
    return <PokemonFilterSummary value={value} onChange={setValue} />
  }
  render(
    <ThemeProvider>
      <Harness />
    </ThemeProvider>,
  )
}

describe('PokemonFilters', () => {
  it('searches by species name from the search popover', async () => {
    const { latest } = renderFilters()
    await userEvent.click(screen.getByRole('button', { name: 'Search' }))
    await userEvent.type(
      await screen.findByRole('textbox', { name: /search/i }),
      'char',
    )
    expect(latest()?.filter.species).toBe('char')
  })

  it('offers types and flags under group headings with a divider', async () => {
    renderFilters()
    await userEvent.click(screen.getByRole('button', { name: 'Filter' }))
    const combo = await screen.findByRole('combobox', { name: /filter/i })
    await userEvent.click(combo)
    await userEvent.keyboard('{ArrowDown}')
    expect(
      await screen.findByRole('option', { name: 'Grass' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Shiny' })).toBeInTheDocument()
    expect(screen.getByText('Types')).toBeInTheDocument()
    expect(screen.getByText('Flags')).toBeInTheDocument()
    expect(screen.getByRole('separator')).toBeInTheDocument()
    // 18 types + 5 flags
    expect(screen.getAllByRole('option')).toHaveLength(23)
  })

  it('filters by a combination of a type and a flag', async () => {
    const { latest } = renderFilters()
    await userEvent.click(screen.getByRole('button', { name: 'Filter' }))
    const combo = await screen.findByRole('combobox', { name: /filter/i })
    await userEvent.click(combo)
    await userEvent.keyboard('{ArrowDown}')
    await userEvent.click(await screen.findByRole('option', { name: 'Grass' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Shiny' }))
    expect(latest()?.filter.types).toEqual(['Grass'])
    expect(latest()?.filter.flags).toEqual(['shiny'])
  })

  it('sorts by a combined key+direction option', async () => {
    const { latest } = renderFilters()
    await userEvent.click(screen.getByRole('button', { name: 'Sort' }))
    const combo = await screen.findByRole('combobox', { name: /sort by/i })
    await userEvent.click(combo)
    await userEvent.keyboard('{ArrowDown}')
    await userEvent.click(
      await screen.findByRole('option', { name: 'CP Desc' }),
    )
    expect(latest()?.sort).toEqual({ key: 'cp', direction: 'desc' })
  })
})

describe('PokemonFilterSummary', () => {
  it('shows active search and filters as chips, plus the sort', () => {
    renderSummary({
      filter: { species: 'venu', types: ['Grass'], flags: ['shiny'] },
      sort: { key: 'cp', direction: 'desc' },
    })
    expect(screen.getByText(/Search: venu/)).toBeInTheDocument()
    expect(screen.getByText('Grass')).toBeInTheDocument()
    expect(screen.getByText('Shiny')).toBeInTheDocument()
    expect(screen.getByText('Sorted by CP Desc')).toBeInTheDocument()
  })

  it('removes a single filter from its chip in one click', async () => {
    renderSummary({
      filter: { species: 'venu', types: ['Grass'] },
      sort: { key: 'name', direction: 'asc' },
    })
    await userEvent.click(screen.getByRole('button', { name: /remove grass/i }))
    expect(screen.queryByText('Grass')).not.toBeInTheDocument()
    // The search chip is untouched.
    expect(screen.getByText(/Search: venu/)).toBeInTheDocument()
  })

  it('clears the search and every filter with Clear all, keeping the sort', async () => {
    renderSummary({
      filter: { species: 'venu', types: ['Grass'] },
      sort: { key: 'name', direction: 'asc' },
    })
    await userEvent.click(screen.getByRole('button', { name: /clear all/i }))
    expect(screen.queryByText('Grass')).not.toBeInTheDocument()
    expect(screen.queryByText(/Search:/)).not.toBeInTheDocument()
    expect(screen.getByText('Sorted by Name Asc')).toBeInTheDocument()
  })

  it('shows just the sort when nothing is filtered', () => {
    renderSummary(INITIAL)
    expect(screen.getByText('Sorted by Name Asc')).toBeInTheDocument()
  })
})
