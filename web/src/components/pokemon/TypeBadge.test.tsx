import { expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@rauboti/ui'
import { TypeBadge } from './TypeBadge'

const renderBadge = (type: string) =>
  render(
    <ThemeProvider>
      <TypeBadge type={type} />
    </ThemeProvider>,
  )

it('renders the type as an icon whose accessible name is the type', () => {
  renderBadge('Grass')
  // Icon-only: the type is the image's accessible name (screen-reader label), not visible text.
  expect(screen.getByRole('img', { name: 'Grass' })).toBeInTheDocument()
  expect(screen.queryByText('Grass')).not.toBeInTheDocument()
})

it('exposes the type as a hover title too', () => {
  renderBadge('Grass')
  expect(screen.getByRole('img', { name: 'Grass' })).toHaveAttribute(
    'title',
    'Grass',
  )
})

it('degrades to a text label for an unknown type', () => {
  const { container } = renderBadge('Mystery')
  expect(screen.getByText('Mystery')).toBeInTheDocument()
  expect(container.querySelector('img')).not.toBeInTheDocument()
})
