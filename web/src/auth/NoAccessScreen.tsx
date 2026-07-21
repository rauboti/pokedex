import { Center, Heading, Stack, Text } from '@chakra-ui/react'
import { Button } from '@rauboti/ui'
import { useAuth } from './AuthContext'

/**
 * Shown by the RequireAuth guard when the user is signed in to hive but has no pokedex grant
 * (empty `roles` / 403 on the data API). A sibling of [LoginScreen], not a routed page: they *are*
 * authenticated, they just can't use pokedex — so the only action is to sign out (e.g. to switch
 * accounts). Access is granted in hive, out of band.
 */
export const NoAccessScreen = () => {
  const { signOut } = useAuth()

  return (
    <Center minH="100dvh" px="4">
      <Stack gap="6" maxW="sm" w="full" textAlign="center">
        <Stack gap="2">
          <Heading size="xl">No access to Pokedex</Heading>
          <Text color="text.muted">
            You&rsquo;re signed in, but your account isn&rsquo;t authorized for
            Pokedex yet. Ask an admin to grant you access.
          </Text>
        </Stack>
        <Button variant="outline" onClick={() => void signOut()}>
          Sign out
        </Button>
      </Stack>
    </Center>
  )
}
