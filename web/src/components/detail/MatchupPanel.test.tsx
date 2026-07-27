import { describe, expect, test } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { ThemeProvider } from '@rauboti/ui'
import { MatchupPanel } from './MatchupPanel'

/**
 * The detail-view type matchups (US4, SC-006's UI half). Weaknesses and resistances come from
 * `defensiveMatchups`, the "strong against" section from `offensiveCoverage` (STAB perspective).
 * Double weaknesses/resistances are visually distinguished from single ones by their stacked
 * multiplier. Fixtures: Charizard (Fire/Flying — the classic double Rock weakness) and pure Normal
 * (a true immunity + no offensive coverage).
 */

const renderPanel = (types: string[], moveTypes?: string[]) =>
  render(
    <ThemeProvider>
      <MatchupPanel types={types} moveTypes={moveTypes} />
    </ThemeProvider>,
  )

const region = (name: string) => screen.getByRole('region', { name })

describe('MatchupPanel — Charizard (Fire/Flying)', () => {
  test('renders weaknesses as type badges', () => {
    renderPanel(['Fire', 'Flying'])
    const weak = region('Weaknesses')
    expect(within(weak).getByAltText('Rock')).toBeInTheDocument()
    expect(within(weak).getByAltText('Water')).toBeInTheDocument()
    expect(within(weak).getByAltText('Electric')).toBeInTheDocument()
  })

  test('distinguishes a double weakness from single ones by its 2.56× multiplier', () => {
    renderPanel(['Fire', 'Flying'])
    const weak = region('Weaknesses')
    // Rock hits both halves -> 2.56x; Water/Electric hit one half -> 1.6x each.
    expect(within(weak).getByText('2.56×')).toBeInTheDocument()
    expect(within(weak).getAllByText('1.6×')).toHaveLength(2)
    expect(within(weak).queryByText('2.56×')).toBeInTheDocument()
    expect(
      within(region('Weaknesses')).queryByText('4×'),
    ).not.toBeInTheDocument()
  })

  test('renders resistances, marking a double resistance with its 0.39× multiplier', () => {
    renderPanel(['Fire', 'Flying'])
    const resist = region('Resistances')
    // Grass and Bug are resisted by both halves -> 0.390625.
    expect(within(resist).getByAltText('Grass')).toBeInTheDocument()
    expect(within(resist).getByAltText('Bug')).toBeInTheDocument()
    expect(within(resist).getAllByText('0.39×').length).toBeGreaterThanOrEqual(
      2,
    )
    // Fire is a single resistance.
    expect(within(resist).getByAltText('Fire')).toBeInTheDocument()
    expect(within(resist).getAllByText('0.63×').length).toBeGreaterThanOrEqual(
      1,
    )
  })

  test('lists STAB super-effective coverage in the strong-against section', () => {
    renderPanel(['Fire', 'Flying'])
    const strong = region('Strong against')
    // Fire -> Bug/Grass/Ice/Steel; Flying -> Bug/Fighting/Grass. Ice is unique to this section.
    expect(within(strong).getByAltText('Ice')).toBeInTheDocument()
    expect(within(strong).getByAltText('Fighting')).toBeInTheDocument()
    expect(within(strong).getByAltText('Steel')).toBeInTheDocument()
  })

  test('does not render a recorded-moves coverage section when no move types are given', () => {
    renderPanel(['Fire', 'Flying'])
    expect(
      screen.queryByRole('region', { name: /move coverage/i }),
    ).not.toBeInTheDocument()
  })
})

describe('MatchupPanel — pure Normal', () => {
  test('labels a true immunity as a strong (0.39×) resistance', () => {
    renderPanel(['Normal'])
    const resist = region('Resistances')
    expect(within(resist).getByAltText('Ghost')).toBeInTheDocument()
    expect(within(resist).getByText('0.39×')).toBeInTheDocument()
  })

  test('shows an explicit empty state when there is no super-effective coverage', () => {
    renderPanel(['Normal'])
    const strong = region('Strong against')
    expect(within(strong).getByText(/none/i)).toBeInTheDocument()
  })
})
