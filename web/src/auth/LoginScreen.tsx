import { Center, Heading, Stack, Text } from '@chakra-ui/react'
import { Button, Callout } from '@rauboti/ui'
import { useSearchParams } from 'react-router'
import { LOGIN_PATH } from '@/api/client'

/**
 * Unauthenticated landing: a single "Sign in with Hive" action that navigates to the BFF's
 * `/auth/login` (a full-page nav — it 302s to hive, so it can't be a client route). When hive is
 * unreachable the OAuth callback bounces back with `?error=signin_unavailable`; we surface that as
 * a Callout (T009).
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
