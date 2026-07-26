import { describe, expect, test, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { ThemeProvider } from '@rauboti/ui'
import { StatsPanel } from './StatsPanel'
import type { Pokemon } from '@/api/schemas'

/**
 * The detail-view stats panel (US3): the server-derived block shown straight from the DTO — level,
 * CP, HP, effective attack/defense/stamina, and the per-stat IV values (rendered as gauges, with the
 * value as themed text). Types and flags now live in the page header, not here. No client math (D7).
 */

// The IV gauges render Highcharts SVG, which jsdom can't lay out; stub the chart wrapper so the
// panel's real themed text — the IV values — is what we assert.
vi.mock('highcharts-react-official', () => ({ HighchartsReact: () => null }))

const pokemon = (over: Partial<Pokemon> = {}): Pokemon => ({
  id: 'p1',
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
    shiny: true,
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
    projections: [],
  },
  stale: false,
  caughtAt: null,
  createdAt: '2026-07-10T18:00:00Z',
  ...over,
})

const renderPanel = (p = pokemon()) =>
  render(
    <ThemeProvider>
      <StatsPanel pokemon={p} />
    </ThemeProvider>,
  )

const panel = () => screen.getByRole('region', { name: 'Stats' })

describe('StatsPanel', () => {
  test('shows level, CP and HP from the derived block', () => {
    renderPanel()
    expect(within(panel()).getByText('25')).toBeInTheDocument()
    expect(within(panel()).getByText('2087')).toBeInTheDocument()
    expect(within(panel()).getByText('123')).toBeInTheDocument()
  })

  test('shows the effective attack, defense and stamina', () => {
    renderPanel()
    expect(within(panel()).getByText('160.4')).toBeInTheDocument()
    expect(within(panel()).getByText('140.2')).toBeInTheDocument()
    expect(within(panel()).getByText('155.7')).toBeInTheDocument()
  })

  test('shows the per-stat IV values and the overall IV%', () => {
    renderPanel()
    expect(within(panel()).getByText('15')).toBeInTheDocument() // atk IV
    expect(within(panel()).getByText('14')).toBeInTheDocument() // def IV
    expect(within(panel()).getByText('13')).toBeInTheDocument() // sta IV
    expect(within(panel()).getByText(/93\.3\s*%/)).toBeInTheDocument()
  })

  test('does not render the species types or catch flags (they live in the header)', () => {
    renderPanel()
    expect(
      within(panel()).queryByRole('img', { name: 'Grass' }),
    ).not.toBeInTheDocument()
    expect(
      within(panel()).queryByRole('img', { name: 'Shiny' }),
    ).not.toBeInTheDocument()
  })
})
