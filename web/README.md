# Pokedex Web (SPA)

The Pokedex frontend: a Vite + React 19 single-page app. It talks only to the Pokedex BFF under `/api`
and **never sees a hive token** — the browser holds only a session cookie.

- **React 19 + TypeScript**, **Chakra UI v3** + [`@rauboti/ui`](https://github.com/rauboti) for the
  shell and primitives.
- **Zod** for runtime-validated API responses, **React Router 7**.
- **Yarn 4** (Node ≥ 22), **Vitest** + React Testing Library + **MSW** for tests.

No i18n and no charting — neither is required by this feature (research D4). All stat math is
server-side; the SPA only displays the derived block.

## Structure

```
src/
├── api/          Typed API client + Zod schemas
│   ├── client.ts   apiRequest<T>: session cookie, Zod validation, 401/403 handling, ApiError
│   └── schemas.ts  Zod schemas + one typed function per endpoint (species, derivation, pokemon, catalog, auth)
├── auth/         AuthContext (session probe), RequireAuth guard, Login / NoAccess screens
├── components/
│   ├── layout/     RootLayout — app shell / navbar (@rauboti/ui)
│   └── pokemon/     collection list, filters, register dialog, and the row/card sub-components
├── lib/          Pure client-side helpers: filterPokemon, sortPokemon (no stat math — that's server-side)
├── pages/        route-level screens (CollectionPage, PokemonDetailPage)
├── assets/types/ vendored per-type badge SVGs (partywhale/pokemon-type-icons, MIT)
├── mocks/        MSW handlers + fixtures (used by tests)
├── routes.tsx    route table
└── main.tsx      app entry
```

## Auth flow

The SPA assumes a **BFF session cookie** — it never handles OAuth directly:

- `client.ts` sends every request with `credentials: 'include'`.
- **401** (no session) → the wrapper redirects the browser to `/auth/login`, which the api forwards to
  hive. The session-bootstrap probe opts out (`redirectOnUnauthorized: false`) so it can render a login
  screen instead.
- **403** (signed in, but no Pokedex role) → a global handler drops the app to the "no access" screen,
  no matter which data call surfaced it. Registered via `setOnForbidden`. The bootstrap probe resolves
  no-access itself from the `me` payload (empty `roles`), so there's no flash of the app first.
- Non-2xx responses reject with an `ApiError` carrying the HTTP status and any RFC-7807 `problem+json`
  body (its machine `code` is what the UI keys on).

## Registration & the collection view

- **Register dialog** (US1): `SpeciesSearch` (server-side name search) → IV/CP fields → a stateless
  `POST /api/derivation` preview that shows the derived level. On a CP collision the `LevelPicker`
  lets the player choose among candidates; an impossible combination surfaces the server's 422.
- **Filter and sort are client-side** — the SPA fetches the caller's whole collection once and does
  the work in pure helpers (`lib/filterPokemon`, `lib/sortPokemon`, research D10); there are no
  server-side query endpoints. Both helpers are unit-tested.
- **Type data is single-sourced** in `pokemonTypes.ts` (vendored icons + the 18 canonical type names),
  so the type badges and the type filter can't drift.

## Develop, test, build

```bash
yarn dev            # Vite dev server on 5173, proxies /api to the api on 5050
yarn test           # Vitest
yarn lint           # ESLint
yarn format         # Prettier --write
yarn build          # tsc -b && vite build
```

For `yarn dev` to reach a backend, run the api first (from the repo root):

```bash
docker compose up pokedex-db pokedex-api
```

Building the web **Docker image** needs a GitHub Packages token for the private `@rauboti/ui` scope —
see `RAUBOTI_PACKAGE_TOKEN` in [`.env.example`](../.env.example) and `.yarnrc.yml`.

## Conventions

- **Every API response is validated with Zod** at the boundary (`apiRequest(path, schema)`); use
  `z.undefined()` for 204s.
- **Pure helpers stay pure and unit-tested** (filtering, sorting) — keep side effects in the api layer
  and components. No stat math here; the server owns it (research D7).
- UI is composed from **`@rauboti/ui` / Chakra** primitives before hand-rolling.
- Imports use the **`@/`** path alias for `src/`.
