import { Center, Spinner } from '@chakra-ui/react'
import { Outlet } from 'react-router'
import { useAuth } from './AuthContext'
import { LoginScreen } from './LoginScreen'
import { NoAccessScreen } from './NoAccessScreen'

/** Pathless layout route gating every child route on the session state from `useAuth()`. */
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
