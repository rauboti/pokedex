import { Center, Heading, Stack, Text } from '@chakra-ui/react'
import { Button, Callout } from '@rauboti/ui'
import { useSearchParams } from 'react-router'
import { LOGIN_PATH } from '@/api/client'

/**
 * Sign-in landing. The action is a full-page navigation to `/auth/login`, not a client route, since it
 * 302s to hive. An unreachable hive bounces back with `?error=signin_unavailable`, surfaced as a Callout.
 */
export const LoginScreen = () => {
  const [params] = useSearchParams()
  const hiveUnavailable = params.get('error') === 'signin_unavailable'

  return (
    <Center minH="100dvh" px="4">
      <Stack gap="6" maxW="sm" w="full" textAlign="center">
        <Stack gap="2">
          <Heading size="2xl">Pokedex</Heading>
          <Text color="text.muted">Track your Pokémon GO collection.</Text>
        </Stack>
        {hiveUnavailable && (
          <Callout status="error">
            Sign-in is temporarily unavailable. Please try again.
          </Callout>
        )}
        <Button asChild size="lg" width="full">
          <a href={LOGIN_PATH}>Sign in with Hive</a>
        </Button>
      </Stack>
    </Center>
  )
}
