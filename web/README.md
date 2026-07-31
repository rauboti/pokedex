# Pokedex Web (SPA)

The Pokedex frontend: a Vite + React 19 single-page app. It talks only to the Pokedex BFF under `/api`
and **never sees a hive token** — the browser holds only a session cookie.

- **React 19 + TypeScript**, **Chakra UI v3** + [`@rauboti/ui`](https://github.com/rauboti) for the
  shell and primitives.
- **Zod** for runtime-validated API responses, **React Router 7**.
- **Yarn 4** (Node ≥ 22), **Vitest** + React Testing Library + **MSW** for tests.

All stat math is server-side; the SPA only displays the derived block. No i18n.

> **This README is the reference.** In-code comments are deliberately terse and cover only local,
> non-obvious decisions; the structure, flows, and conventions live here. Several modules point back at
> a named section below.

## Structure

```
src/
├── api/
│   ├── client.ts       apiRequest<T>: session cookie, Zod validation, 401/403 handling, ApiError
│   └── schemas.ts      one Zod schema + one function per contract operation
├── auth/               AuthContext (session probe), RequireAuth guard, Login / NoAccess screens
├── components/
│   ├── layout/         RootLayout — app shell / navbar (@rauboti/ui AppShell)
│   ├── pokemon/        collection list + cards, filters/sort toolbar, register/edit dialog,
│   │                   species search, level picker, sprite, type + flag badges, IV stars
│   └── detail/         StatsPanel, ProjectionsPanel, MatchupPanel, MovesPanel + shared StatTable
├── lib/                pure helpers: filterPokemon, sortPokemon, matchups, typeChart
├── pages/              CollectionPage (landing), PokemonDetailPage
├── assets/types/       vendored per-type badge SVGs (partywhale/pokemon-type-icons, MIT — see LICENSE)
├── mocks/              MSW handlers + fixtures (test server and dev worker)
├── test/setup.ts       jsdom shims + MSW lifecycle
├── routes.tsx          route table
└── main.tsx            app entry
```

`lib/` and `components/detail/projections.ts` are React-free on purpose — pure, directly unit-tested,
and (for `projections.ts`) split out so the panel file stays component-only for react-refresh.

## Auth flow

The SPA assumes a **BFF session cookie** and never handles OAuth itself:

- `client.ts` sends every request with `credentials: 'include'`.
- **401** (no session) → the wrapper redirects the browser to `/auth/login`, which the api forwards to
  hive. That is a full-page navigation, not a client route, because it 302s off-origin.
- **403** (signed in, no pokedex grant) → a global handler, registered by the AuthProvider via
  `setOnForbidden`, drops the app to the no-access screen no matter which data call surfaced it.
- The **session-bootstrap probe opts out of both** (`redirectOnUnauthorized: false`,
  `notifyForbidden: false`) so it can render a login screen instead of bouncing, and can resolve
  no-access from the `me` payload's empty `roles`. That is what avoids a flash of the app before the
  no-access screen appears.
- Non-2xx rejects with an `ApiError` carrying the status and any RFC-7807 `problem+json` body — its
  machine `code` is what the UI keys on, never the human message.

Returning from the hive callback with `?error=signin_unavailable` renders a Callout on the login screen.

## Registration and the collection view

**Register / edit dialog** — species search → IV/CP fields → a stateless `POST /api/derivation` preview
showing the derived level. On a CP collision the `LevelPicker` requires a choice; an impossible
combination surfaces the server's 422. Save is blocked until the derivation confirms exactly one level.
Two implementation details matter:

- The caller **remounts the dialog per target** with a fresh `key`, so the edit prefill runs from
  `useState` initialisers and needs no state-syncing effect.
- The derivation result is **tagged with the inputs that produced it**, so a late response can never
  render against changed inputs.

**Collection grid** — a responsive `Grid` of `Card`s, up to four columns, with `autoFill` so a lone card
holds its column width. Each card stacks name + types, sprite, CP, HP · Level, a **fixed-height**
attributes row (so cards align even when a Pokémon has no attributes), then IV stars and the row
actions. The card uses a **stretched link**: the name is the real focusable anchor and its `::after`
overlays the card, so the edit/delete buttons must stay raised above it (`zIndex`) to keep working.
A rebalanced (`stale`) row wears a re-check badge and its edit action reads "Re-enter".

**IV quality** shows as a GO-style star rating rather than a raw number — 1 yellow star per 25% band,
four **pink** stars for a hundo. The exact percentage stays in the accessible label.

**Filter and sort are client-side.** The SPA fetches the whole collection once and slices it with the
pure helpers; there are no server-side query endpoints. Types combine with OR (a dual-type matches on
either), flags with AND. Sort is stable via an explicit index tiebreak rather than trusting the engine,
`caughtAt` nulls sort last in _both_ directions, and `name` breaks ties on form so a base form leads its
regional variants.

## Vendored type chart

`lib/typeChart.ts` is the **only game constant on the web tier** (constitution Game Data Constraints:
stable reference tables are vendored, never fetched). Matchups are therefore computed entirely
client-side from `Species.types`, and the api ships no type-effectiveness endpoint.

GO has no true 0× immunity — a main-series immunity becomes 0.625² = 0.390625, "immune in effect". The
four multipliers are 1.6 / 1 / 0.625 / 0.390625. Dual types stack multiplicatively, so effectiveness
reaches 2.56× (double weakness) or 0.390625×, and products are rounded to kill IEEE-754 noise. The chart
is authored as readable per-attacker relation lists and expanded to the full 18×18 matrix at module
load, so no cell can be left half-filled. Sources are cited in the file header.

Type names are single-sourced in `components/pokemon/pokemonTypes.ts` (the 18 canonical names + their
vendored icons) so badges and the type filter cannot drift from each other or from the api.

## Charting

`components/detail/IvGauges.tsx` renders the per-stat IV breakdown as Highcharts solid-gauge KPIs, and is
the app's **only** chart.

> **Divergence from plan.md.** Research D4 recorded "no charting" and T002 deliberately omitted
> Highcharts from the dependency set. It was added later for these gauges, so `highcharts` and
> `highcharts-react-official` are now real dependencies. Worth reconciling into plan.md as an amendment
> — either as a justified deviation or by replacing the gauges. The gauge itself is slated to move
> behind a shared charting wrapper.

The gauge arc is decorative (`aria-hidden`); the value and label are real text beneath it, so the number
stays app-themed and screen-reader visible.

## Develop, test, build

```bash
yarn dev
```

```bash
yarn test --run
```

```bash
yarn lint
```

```bash
yarn format
```

```bash
yarn build
```

`yarn dev` serves on 5173 and proxies both `/api` (data) and `/auth` (the BFF OAuth handshake) to the api
on 5050. `yarn test` alone starts Vitest in watch mode — use `--run` for a single pass. For `yarn dev` to
reach a backend, start the api first from the repo root:

```bash
docker compose up pokedex-db pokedex-api
```

Set `VITE_ENABLE_MSW=true` to run entirely against the MSW worker instead, with no api at all.

Building the web **Docker image** needs a GitHub Packages token for the private `@rauboti/ui` scope — see
`RAUBOTI_PACKAGE_TOKEN` in [`.env.example`](../.env.example) and `.yarnrc.yml`.

**Tests** — Vitest + RTL + MSW. `test/setup.ts` shims what jsdom lacks but the libraries need:
`CSS.supports` and `SVGElement.getBBox` (Highcharts throws on import without them), plus
`matchMedia`/`ResizeObserver` for Chakra and next-themes, defaulted to the light scheme for deterministic
colour-mode assertions. MSW is set to fail loudly on any un-mocked request.

## Conventions

- **Every API response is validated with Zod** at the boundary (`apiRequest(path, schema)`); use
  `z.undefined()` for 204s.
- **Pure helpers stay pure and unit-tested**; side effects live in the api layer and components. No stat
  math here — the server owns it.
- **UI is composed from `@rauboti/ui` / Chakra** before anything hand-rolled. Where the library has no
  primitive, that is called out rather than worked around silently: `SpeciesSearch` is bespoke because
  `Combobox` has no async/remote-item support, and there is still no `Checkbox`/`Switch`/`Radio` for a
  standalone boolean toggle.
- Form controls are marked `required` purely to suppress the DS "(optional)" hint where a value is always
  present (an empty filter means "All"; sort always has a selection).
- **Comments stay minimal**; rationale belongs in this README.
- Imports use the **`@/`** path alias for `src/`.
