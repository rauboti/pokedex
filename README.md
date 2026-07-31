# Pokedex

Pokedex tracks a player's **Pokémon GO** collection: register a catch (species incl. forms, IVs, and
the CP you see in-game), and the app derives its level, computes every stat, spots hundos, and
projects it to L40 / L50 / Best Buddy. Browse, filter, and sort the collection; read type matchups;
and record each Pokémon's moves against a recommended moveset.

**All stat math is server-side** — one authoritative CP→level solver, verified against community
calculators ([research D7](specs/001-pokemon-collection-tracker/research.md)). Species base stats and
move data are **synced from a community Game Master source, never hardcoded**
([FR-011](specs/001-pokemon-collection-tracker/spec.md)); only the CPM, stardust, and type-chart
reference tables are vendored.

Pokedex is one app in the wider platform monorepo and delegates identity to **hive** (the platform's
identity service). It runs as its own three-service Docker Compose stack.

## Architecture at a glance

Two tiers, one stack:

| Tier | Path | Stack | Host port |
|------|------|-------|-----------|
| **Web SPA** | [`web/`](web/README.md) | Vite + React 19 + Chakra UI v3 + [`@rauboti/ui`](https://github.com/rauboti), TypeScript | **3050** |
| **BFF API** | [`api/`](api/README.md) | Kotlin (JDK 25) + Spring Boot 4.1, `JdbcClient` (no JPA), Flyway, package root `no.rauboti.pokedex` | **5050** |
| **Database** | (container) | PostgreSQL 17 | **5437** |

Pokedex owns the **3050 / 5050 / 5437** port band, reserved for it in the platform stack (constitution
[Platform Integration Constraints](.specify/memory/constitution.md)) — clear of hive (3000/5000/5432),
taskmaster, pulse, avec, and tome.

The **api** is a Backend-for-Frontend: it owns all collection data in Postgres, brokers the hive OAuth
login, holds the hive token server-side (the browser only ever gets a session cookie), syncs the
species/move catalog, and does **all** stat math. The **web** SPA talks only to the api under `/api`,
never sees a hive token, and does filtering/sorting and type-matchup display client-side from vendored
reference data.

**The three READMEs are the reference documentation.** In-code comments are deliberately terse and cover
only local, non-obvious decisions — architecture, formulas, invariants, and flows live in the READMEs,
and classes point back at named sections. This file covers the stack and how to run it;
[`api/README.md`](api/README.md) covers the auth model, schema, stat engine, catalog sync, moveset
ranking, and write invariants; [`web/README.md`](web/README.md) covers the SPA's auth flow, the
collection and registration UI, the vendored type chart, and its conventions.

## Prerequisites

- **Docker** (compose v2) — the stack, and Testcontainers for the api integration tests
- **JDK 25** + the bundled Maven wrapper (`api/mvnw`) — api development
- **Node ≥ 22** + **Yarn 4** (via corepack) — web development
- **`RAUBOTI_PACKAGE_TOKEN`** — a GitHub Packages `read:packages` token for the private
  `@rauboti/ui` scope. Needed to build the `web` image or run `yarn install`; export it or set it in
  `.env` (also mirrored in `web/.yarnrc.yml`, gitignored — copy `web/.yarnrc.yml.example`).
- **hive running, with a `pokedex` client registered.** Pokedex implements no login of its own
  (constitution Principle V) — every sign-in is an OAuth Authorization-Code + PKCE handshake against
  hive, so without it you can reach the app but not get past the login screen. The hive-side
  registration needs:
  - client id **`pokedex`** (`HIVE_CLIENT_ID`) and a client secret → `HIVE_CLIENT_SECRET`
    (the dev-seeded secret `pokedex-local-dev` is the `dev` profile default);
  - the redirect URI **`{WEB_BASE_URL}/auth/callback`** — `http://localhost:3050/auth/callback` for
    the Docker stack, `http://localhost:5173/auth/callback` if you run the api standalone against the
    Vite dev server;
  - a Pokedex app role (**`user`** or **`admin`**) granted to each user. A signed-in hive user with no
    Pokedex grant gets a 403 and the app's "no access" screen; catalog sync is **admin-only**.

  Two hive base URLs matter: `HIVE_EXTERNAL_URL` is how the *browser* reaches hive (and the expected
  token `iss`); `HIVE_INTERNAL_URL` is how the *api container* reaches it (token exchange + JWKS) —
  hive's service name in the combined stack, the same localhost URL standalone.

## Running the stack

Everything is defined in [`docker-compose.yml`](docker-compose.yml). Copy the env template first
(defaults boot the stack as-is; fill in the hive client secret to exercise login):

```bash
cp .env.example .env
```

**Full stack in Docker** — web on 3050, api on 5050, db on 5437:

```bash
docker compose up --build
```

**Web dev loop** — Vite dev server on 5173 with HMR, proxying `/api` to the containerised api:

```bash
docker compose up pokedex-db pokedex-api
cd web && yarn dev
```

**Api dev loop** — Spring Boot on 5050 against the containerised db only (Flyway migrates on start;
the app defaults to the 5437 published port and to the Vite origin as its web base URL):

```bash
docker compose up pokedex-db
cd api && ./mvnw spring-boot:run
```

In the **combined platform stack**, run `docker compose up` from `platform/` instead — pokedex joins
via an `include` entry plus `platform/pokedex.env`
([research D11](specs/001-pokemon-collection-tracker/research.md)).

On first api start with an empty catalog, one game-data sync runs in the background — best-effort, so
the app still starts if the source is down, and an admin can re-run it later
(`POST /api/catalog/sync`). `GET /api/catalog` reports the row counts and `syncedAt`. See
[`.env.example`](.env.example) for every knob.

### Tests

Both suites must be green at every merge (constitution Principle II):

```bash
cd api && ./mvnw verify
```

```bash
cd web && yarn lint && yarn test
```

`mvnw verify` runs the unit (formulas, CP→level solver, moveset ranker), contract (MockMvc), and
integration (Testcontainers — needs Docker) tests plus the Spotless check. The stat-math suite pins
the SC-002 sample: ≥10 real Pokémon cross-checked against PvPoke and GO Hub. The full end-to-end
validation walkthrough lives in
[`quickstart.md`](specs/001-pokemon-collection-tracker/quickstart.md).

## Game data: synced, vendored, or entered by hand

The constitution's [Game Data Constraints](.specify/memory/constitution.md) fix where every kind of
game data may come from, and the code follows that split:

| Data | Source | Why |
|------|--------|-----|
| Species base stats, forms, types, moves, move pools | **Synced** at runtime from a community Game Master feed — [pokemon-go-api](https://pokemon-go-api.github.io/pokemon-go-api) (`GAMEDATA_BASE_URL`), normalized and upserted into `species` / `move` / `species_move` with a recorded `syncedAt` | Species get rebalanced and new forms land constantly, so base stats MUST NOT be hardcoded (FR-011). A sync also drives the staleness rescan that re-flags affected Pokémon (FR-013). |
| CP multipliers, power-up stardust costs, the type chart | **Vendored** in-repo — `api/src/main/resources/reference/{cpm,dust}.json` and `web/src/lib/typeChart.ts` | Effectively static tables. The constitution mandates vendoring CPM; the solver wants it in memory, dust labels the collision candidates, and the type chart drives a purely presentational view. Vendoring removes a runtime network dependency for data that never changes. |
| A player's own collection | **Entered manually** in the app | There is no official Pokémon GO player-data API, and reverse-engineered clients breach the game's ToS — pokedex integrates with none (FR-012). |

Point `GAMEDATA_BASE_URL` at a stub or a dead host to exercise the sync failure paths: the fetch and
normalization happen outside the transaction, so a bad source leaves the catalog untouched.

## Where things live

- **Feature spec & design** — [`specs/001-pokemon-collection-tracker/`](specs/001-pokemon-collection-tracker/):
  [`spec.md`](specs/001-pokemon-collection-tracker/spec.md),
  [`plan.md`](specs/001-pokemon-collection-tracker/plan.md),
  [`research.md`](specs/001-pokemon-collection-tracker/research.md),
  [`data-model.md`](specs/001-pokemon-collection-tracker/data-model.md),
  [`contracts/openapi.yaml`](specs/001-pokemon-collection-tracker/contracts/openapi.yaml),
  [`quickstart.md`](specs/001-pokemon-collection-tracker/quickstart.md), and
  [`tasks.md`](specs/001-pokemon-collection-tracker/tasks.md). The OpenAPI contract is the source of
  truth for the wire shape; the numbered `FR-xxx` / `SC-xxx` / `Dx` / `Txxx` markers throughout the
  code trace back to these documents.
- **Project principles** — [`.specify/memory/constitution.md`](.specify/memory/constitution.md).
- **Backend reference** — [`api/README.md`](api/README.md): module map, endpoint surface, auth model,
  schema, stat engine, catalog sync, moveset ranking, write invariants, error codes.
- **Frontend reference** — [`web/README.md`](web/README.md): structure, auth flow, registration and
  collection UI, vendored type chart, charting, conventions.

> **Two divergences from `plan.md`** turned up while documenting the tiers and are recorded in the tier
> READMEs pending a plan amendment: the api's package layout differs from the plan's Project Structure
> (no `gamedata/`; `derivation/` and `caughtpokemon/` are their own packages), and the web app now depends
> on **Highcharts** for the detail view's IV gauges, which research D4 had ruled out.

> **Status.** Active feature: **Pokémon Collection Tracker**. All five in-scope user stories are
> implemented: auth (hive BFF), the game-data catalog sync + post-sync staleness rescan, the
> server-side stat engine (CP→level derivation with collision handling, projections, IV%), Pokémon
> CRUD, the collection view (search-to-register dialog, client-side filter/sort, hundo highlight), and
> the detail page (stats, L40/L50/Best Buddy projections, type matchups, and recorded-vs-recommended
> moves off the sync-time moveset ranker). Remaining: polish — an admin "refresh catalog" affordance,
> dev seed data, a hygiene pass, and the full quickstart validation run. Badges (US6) are deferred.
> See [`plan.md`](specs/001-pokemon-collection-tracker/plan.md) for the full target.

## Contributing

Every implementation task gets a **fresh feature branch off `main`, created before any code**; agents
leave work uncommitted for review. No direct commits to `main`. The full rule (and the hook that
enforces it) is in [`CLAUDE.md`](CLAUDE.md).
