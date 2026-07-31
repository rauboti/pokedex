import { Box, Text } from '@chakra-ui/react'
import { NavLink, Outlet } from 'react-router'
import { AppShell, ColorModeButton, Navbar, UserMenu } from '@rauboti/ui'
import { useAuth } from '@/auth/AuthContext'

/**
 * App shell built on @rauboti/ui's `AppShell` — centred column, skip link, footer, and a Navbar whose
 * actions hold the colour-mode toggle and the shared `UserMenu`. pokedex has one destination (`/`), so
 * the detail page is reached by opening a row rather than from the navbar. Renders only behind
 * RequireAuth, so there is no signed-out variant.
 */
export const RootLayout = () => {
  const { user, signOut } = useAuth()
  const onSignOut = () => void signOut()

  const userMenu = (inline: boolean) => (
    <UserMenu
      name={user?.name}
      onSignOut={onSignOut}
      signOutLabel="Sign out"
      inline={inline}
    />
  )

  return (
    <AppShell
      nav={
        <Navbar
          brand="Pokedex"
          actions={
            <>
              <ColorModeButton />
              <Box hideBelow="md">{userMenu(false)}</Box>
            </>
          }
          drawerExtra={userMenu(true)}
        >
          <Navbar.Item asChild>
            <NavLink to="/" end>
              Collection
            </NavLink>
          </Navbar.Item>
        </Navbar>
      }
      footer={
        <Text color="text.muted" fontSize="sm">
          Pokedex
        </Text>
      }
    >
      <Outlet />
    </AppShell>
  )
}
