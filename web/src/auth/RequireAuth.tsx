import { Center, Spinner } from '@chakra-ui/react'
import { Outlet } from 'react-router'
import { useAuth } from './AuthContext'
import { LoginScreen } from './LoginScreen'
import { NoAccessScreen } from './NoAccessScreen'

/**
 * Route guard (a pathless layout route in `routes.tsx`). Gates every child route on the session
 * state from `useAuth()`: a spinner while the `/api/auth/me` probe is in flight, the login screen
 * when unauthenticated, the no-access screen when signed in without a pokedex grant, and the routed
 * app (`<Outlet/>`, rendered inside the RootLayout shell) once signed in with access.
 */
export const RequireAuth = () => {
  const { status } = useAuth()

  if (status === 'loading') {
    return (
      <Center minH="100dvh" role="status" aria-label="Checking your session">
        <Spinner />
      </Center>
    )
  }

  if (status === 'unauthenticated') return <LoginScreen />
  if (status === 'noAccess') return <NoAccessScreen />

  return <Outlet />
}
