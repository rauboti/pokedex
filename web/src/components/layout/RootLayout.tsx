import { Box, Text } from '@chakra-ui/react'
import { NavLink, Outlet } from 'react-router'
import { AppShell, ColorModeButton, Navbar, UserMenu } from '@rauboti/ui'
import { useAuth } from '@/auth/AuthContext'

/**
 * App shell: hosts the routed pages via <Outlet/>. The centred column, the "skip to content" link,
 * and the footer frame come from @rauboti/ui's AppShell. The Navbar's actions hold the colour-mode
 * toggle plus the shared @rauboti/ui UserMenu — a dropdown on desktop (hidden on mobile), repeated
 * inline in the mobile drawer beneath the nav links. pokedex has a single destination (the
 * collection at `/`); the Pokémon detail page is reached by opening a row, not from the navbar. No
 * profile/language item (no i18n — research D4); the menu's only action is Sign out via
 * `signOutLabel`. Session data + sign-out come from useAuth; RootLayout only renders behind
 * RequireAuth, so there's no signed-out variant.
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
