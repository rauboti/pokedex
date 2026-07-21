/* eslint-disable react-refresh/only-export-components -- the provider and its `useAuth`
   hook are one cohesive module; co-locating them only costs this file a full HMR reload. */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { ApiError, setOnForbidden } from '@/api/client'
import { logout, me, type Me } from '@/api/schemas'

/** Session state, resolved once the `/api/auth/me` probe settles. `noAccess` is a signed-in
 *  hive user with no pokedex grant (empty `roles`) — distinct from `unauthenticated` (not signed
 *  in). */
export type AuthState =
  | { status: 'loading'; user: null }
  | { status: 'authenticated'; user: Me }
  | { status: 'unauthenticated'; user: null }
  | { status: 'noAccess'; user: null }

type AuthContextValue = AuthState & {
  /** Re-run the session probe (e.g. after returning from the hive callback). */
  reload: () => Promise<void>
  /** Clear the server session (`POST /api/auth/logout`) and drop to unauthenticated. */
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * Probe the session. A 401 means "not signed in". A signed-in user with no pokedex role (empty
 * `roles`) has no pokedex access — resolved here from the `me` payload, so there's no flash of the
 * app before a data call fails. The probe opts out of the client's auto-redirect (so the app can
 * render a login screen instead of bouncing to hive) and of the global no-access handler. The `me`
 * endpoint itself is authenticated-only today; the 403 catch is a safety net should it ever be
 * gated.
 */
const fetchSession = async (signal: AbortSignal): Promise<AuthState> => {
  try {
    const user = await me({
      redirectOnUnauthorized: false,
      notifyForbidden: false,
      signal,
    })
    if (user.roles.length === 0) return { status: 'noAccess', user: null }
    return { status: 'authenticated', user }
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      return { status: 'noAccess', user: null }
    }
    return { status: 'unauthenticated', user: null }
  }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AuthState>({
    status: 'loading',
    user: null,
  })

  useEffect(() => {
    const controller = new AbortController()
    fetchSession(controller.signal).then((next) => {
      if (!controller.signal.aborted) setState(next)
    })
    // Any later data call that 403s (e.g. a role revoked mid-session) drops the whole app to the
    // no-access screen, no matter which request surfaced it.
    setOnForbidden(() => setState({ status: 'noAccess', user: null }))
    return () => {
      controller.abort()
      setOnForbidden(null)
    }
  }, [])

  const reload = useCallback(async () => {
    setState({ status: 'loading', user: null })
    setState(await fetchSession(new AbortController().signal))
  }, [])

  const signOut = useCallback(async () => {
    // Best-effort server logout; drop to unauthenticated regardless so the guard shows the login
    // screen (a dead session is already effectively logged out).
    try {
      await logout()
    } finally {
      setState({ status: 'unauthenticated', user: null })
    }
  }, [])

  return (
    <AuthContext value={{ ...state, reload, signOut }}>{children}</AuthContext>
  )
}

/** Access the current session. Throws if used outside an `<AuthProvider>`. */
export const useAuth = (): AuthContextValue => {
  const value = useContext(AuthContext)
  if (value === null) {
    throw new Error('useAuth must be used within an <AuthProvider>')
  }
  return value
}
