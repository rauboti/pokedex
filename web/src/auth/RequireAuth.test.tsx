import { describe, expect, test } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { http, HttpResponse, delay } from 'msw'
import { ThemeProvider } from '@rauboti/ui'
import { AuthProvider } from './AuthContext'
import { RequireAuth } from './RequireAuth'
import { RootLayout } from '@/components/layout/RootLayout'
import { server } from '@/mocks/server'

const meUser = {
  sub: '10000000-0000-4000-8000-000000000001',
  name: 'Ada Lovelace',
  roles: ['user'],
}

// The real route shape: RequireAuth gates RootLayout, which frames the routed pages. Rendering the
// full tree lets these tests assert both the guard states and the signed-in navbar/sign-out.
const routes = [
  {
    element: <RequireAuth />,
    children: [
      {
        element: <RootLayout />,
        children: [{ path: '/', element: <div>collection page</div> }],
      },
    ],
  },
]

const renderGuard = () => {
  const router = createMemoryRouter(routes, { initialEntries: ['/'] })
  render(
    <ThemeProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ThemeProvider>,
  )
}

describe('RequireAuth', () => {
  test('shows a loading status while the session probe is in flight', async () => {
    server.use(
      http.get('/api/auth/me', async () => {
        await delay('infinite')
        return HttpResponse.json({})
      }),
    )

    renderGuard()

    expect(
      screen.getByRole('status', { name: /checking your session/i }),
    ).toBeInTheDocument()
    expect(screen.queryByText('collection page')).not.toBeInTheDocument()
  })

  test('renders the app with the user name, the Collection nav link and a user menu once authenticated', async () => {
    // Default handler reports a signed-in session with access.
    renderGuard()

    expect(await screen.findByText('collection page')).toBeInTheDocument()
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Collection' })).toBeInTheDocument()
    // Sign out lives in the user-menu dropdown; open it from the avatar/name trigger.
    await userEvent.click(screen.getByRole('button', { name: /ada lovelace/i }))
    expect(
      await screen.findByRole('menuitem', { name: /sign out/i }),
    ).toBeInTheDocument()
  })

  test('renders the login screen when unauthenticated (401)', async () => {
    server.use(
      http.get('/api/auth/me', () =>
        HttpResponse.json({ status: 401 }, { status: 401 }),
      ),
    )

    renderGuard()

    expect(
      await screen.findByRole('link', { name: /sign in with hive/i }),
    ).toBeInTheDocument()
    expect(screen.queryByText('collection page')).not.toBeInTheDocument()
  })

  test('renders the no-access screen when signed in without a pokedex grant (empty roles)', async () => {
    server.use(
      http.get('/api/auth/me', () =>
        HttpResponse.json({ ...meUser, roles: [] }),
      ),
    )

    renderGuard()

    expect(
      await screen.findByRole('heading', { name: /no access to pokedex/i }),
    ).toBeInTheDocument()
    expect(screen.queryByText('collection page')).not.toBeInTheDocument()
  })

  test('sign-out posts to /api/auth/logout and returns to the login screen', async () => {
    let loggedOut = false
    server.use(
      http.get('/api/auth/me', () => HttpResponse.json(meUser)),
      http.post('/api/auth/logout', () => {
        loggedOut = true
        return new HttpResponse(null, { status: 204 })
      }),
    )

    renderGuard()

    await userEvent.click(
      await screen.findByRole('button', { name: /ada lovelace/i }),
    )
    await userEvent.click(
      await screen.findByRole('menuitem', { name: /sign out/i }),
    )

    await waitFor(() => expect(loggedOut).toBe(true))
    expect(
      await screen.findByRole('link', { name: /sign in with hive/i }),
    ).toBeInTheDocument()
  })
})
