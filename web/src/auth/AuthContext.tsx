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

/** `noAccess` (signed in, no pokedex grant) is deliberately distinct from `unauthenticated`. */
export type AuthState =
  | { status: 'loading'; user: null }
  | { status: 'authenticated'; user: Me }
  | { status: 'unauthenticated'; user: null }
  | { status: 'noAccess'; user: null }

type AuthContextValue = AuthState & {
  reload: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * Resolves no-access from the `me` payload rather than waiting for a data call to fail, so the app
 * never flashes before the no-access screen. Opts out of the client's auto-redirect so a login screen
 * can render instead of bouncing to hive; the 403 catch is a safety net if `me` is ever gated.
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
    // A later 403 (e.g. a role revoked mid-session) drops the whole app, whichever call surfaced it.
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
    // Best-effort: drop to unauthenticated regardless, since a dead session is already logged out.
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

/** Throws outside an `<AuthProvider>`. */
export const useAuth = (): AuthContextValue => {
  const value = useContext(AuthContext)
  if (value === null) {
    throw new Error('useAuth must be used within an <AuthProvider>')
  }
  return value
}
