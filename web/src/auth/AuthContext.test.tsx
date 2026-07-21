import { describe, expect, test, vi } from 'vitest'
import { render, renderHook, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { AuthProvider, useAuth } from './AuthContext'

const meUser = {
  sub: '10000000-0000-4000-8000-000000000001',
  name: 'Ada Lovelace',
  roles: ['user'],
}

const StatusProbe = () => {
  const { status, user } = useAuth()
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="name">{user?.name ?? ''}</span>
    </div>
  )
}

describe('AuthProvider + useAuth', () => {
  test('bootstraps to authenticated when /api/auth/me returns a user with a role', async () => {
    server.use(http.get('/api/auth/me', () => HttpResponse.json(meUser)))

    render(
      <AuthProvider>
        <StatusProbe />
      </AuthProvider>,
    )

    expect(screen.getByTestId('status')).toHaveTextContent('loading')
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('authenticated'),
    )
    expect(screen.getByTestId('name')).toHaveTextContent('Ada Lovelace')
  })

  test('bootstraps to unauthenticated on 401 without redirecting to hive', async () => {
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign })
    server.use(
      http.get('/api/auth/me', () =>
        HttpResponse.json({ status: 401 }, { status: 401 }),
      ),
    )

    render(
      <AuthProvider>
        <StatusProbe />
      </AuthProvider>,
    )

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'),
    )
    expect(screen.getByTestId('name')).toHaveTextContent('')
    expect(assign).not.toHaveBeenCalled()
  })

  test('bootstraps to noAccess when signed in without a pokedex role (empty roles)', async () => {
    server.use(
      http.get('/api/auth/me', () =>
        HttpResponse.json({ ...meUser, roles: [] }),
      ),
    )

    render(
      <AuthProvider>
        <StatusProbe />
      </AuthProvider>,
    )

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('noAccess'),
    )
    expect(screen.getByTestId('name')).toHaveTextContent('')
  })

  test('useAuth throws when used outside an AuthProvider', () => {
    expect(() => renderHook(() => useAuth())).toThrow(
      /within an <AuthProvider>/,
    )
  })

  test('signOut posts to the logout endpoint and drops to unauthenticated', async () => {
    let loggedOut = false
    server.use(
      http.get('/api/auth/me', () => HttpResponse.json(meUser)),
      http.post('/api/auth/logout', () => {
        loggedOut = true
        return new HttpResponse(null, { status: 204 })
      }),
    )

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })
    await waitFor(() => expect(result.current.status).toBe('authenticated'))

    await result.current.signOut()

    expect(loggedOut).toBe(true)
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'))
    expect(result.current.user).toBeNull()
  })
})
