import { describe, expect, test } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { ThemeProvider } from '@rauboti/ui'
import { ProjectionsPanel } from './ProjectionsPanel'
import { projectionRows } from './projections'
import type { Projection } from '@/api/schemas'

/**
 * The detail-view projections (US3, FR-009). `projectionRows` is the pure DTO→display mapping; the
 * panel renders those as a light table — L40/L50 always, the Best-Buddy row only when present. Values
 * come straight from the DTO (no client math, research D7).
 */

const L40: Projection = {
  label: 'L40',
  level: 40,
  cp: 3000,
  hp: 150,
  attack: 180,
  defense: 170,
  stamina: 175,
}
const L50: Projection = {
  label: 'L50',
  level: 50,
  cp: 3400,
  hp: 165,
  attack: 195,
  defense: 185,
  stamina: 190,
}
const BEST_BUDDY: Projection = {
  label: 'BEST_BUDDY',
  level: 26,
  cp: 2200,
  hp: 130,
  attack: 150,
  defense: 145,
  stamina: 152,
}

describe('projectionRows', () => {
  test('maps each projection to a display row with its label and CP', () => {
    const rows = projectionRows([L40, L50])
    expect(rows.map((r) => r.target)).toEqual(['L40', 'L50'])
    expect(rows[0].cp).toBe(3000)
    expect(rows[1].cp).toBe(3400)
  })

  test('labels a Best-Buddy projection "Best Buddy", and only when present', () => {
    expect(projectionRows([L40, L50]).map((r) => r.target)).not.toContain(
      'Best Buddy',
    )
    expect(
      projectionRows([L40, L50, BEST_BUDDY]).map((r) => r.target),
    ).toContain('Best Buddy')
  })
})

describe('ProjectionsPanel', () => {
  const renderPanel = (projections: Projection[]) =>
    render(
      <ThemeProvider>
        <ProjectionsPanel projections={projections} />
      </ThemeProvider>,
    )
  const panel = () => screen.getByRole('region', { name: 'Projections' })

  test('renders the L40 and L50 rows with their CP', () => {
    renderPanel([L40, L50])
    expect(within(panel()).getByText('L40')).toBeInTheDocument()
    expect(within(panel()).getByText('3000')).toBeInTheDocument()
    expect(within(panel()).getByText('L50')).toBeInTheDocument()
    expect(within(panel()).getByText('3400')).toBeInTheDocument()
  })

  test('renders the Best Buddy row when a Best-Buddy projection is present', () => {
    renderPanel([L40, L50, BEST_BUDDY])
    expect(within(panel()).getByText('Best Buddy')).toBeInTheDocument()
    expect(within(panel()).getByText('2200')).toBeInTheDocument()
  })

  test('omits the Best Buddy row when no Best-Buddy projection is present', () => {
    renderPanel([L40, L50])
    expect(within(panel()).queryByText('Best Buddy')).not.toBeInTheDocument()
  })
})
