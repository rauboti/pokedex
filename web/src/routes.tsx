import type { RouteObject } from 'react-router'
import { RootLayout } from '@/components/layout/RootLayout'
import { RequireAuth } from '@/auth/RequireAuth'
import { CollectionPage } from '@/pages/CollectionPage'
import { PokemonDetailPage } from '@/pages/PokemonDetailPage'

/** Route table: RequireAuth gates the app (login screen when signed out, no-access screen when
 *  signed in without a pokedex grant); signed-in pages render inside the RootLayout shell via its
 *  <Outlet/>. The collection is the landing page (`/`); a Pokémon's detail view lives at
 *  `/pokemon/:id`, reached by opening a row. Registration has no route of its own — it runs as a
 *  dialog inside the collection page (US1). */
export const routes: RouteObject[] = [
  {
    element: <RequireAuth />,
    children: [
      {
        path: '/',
        element: <RootLayout />,
        children: [
          { index: true, element: <CollectionPage /> },
          { path: 'pokemon/:id', element: <PokemonDetailPage /> },
        ],
      },
    ],
  },
]
