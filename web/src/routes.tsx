import type { RouteObject } from 'react-router'
import { RootLayout } from '@/components/layout/RootLayout'
import { RequireAuth } from '@/auth/RequireAuth'
import { CollectionPage } from '@/pages/CollectionPage'
import { PokemonDetailPage } from '@/pages/PokemonDetailPage'

/** RequireAuth gates everything; signed-in pages render inside the RootLayout shell. Registration
 *  has no route of its own — it is a dialog on the collection page. */
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
