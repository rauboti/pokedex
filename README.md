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

| Tier | Path | Stack |
|------|------|-------|
| **BFF API** | [`api/`](api/README.md) | Kotlin + Spring Boot 4.1, `JdbcClient` (no JPA), Flyway, package root `no.rauboti.pokedex` |
| **Web SPA** | [`web/`](web/README.md) | Vite + React 19 + Chakra UI v3 + [`@rauboti/ui`](https://github.com/rauboti), TypeScript |
| **Database** | (container) | PostgreSQL 17 |

The **api** is a Backend-for-Frontend: it owns all collection data in Postgres, brokers the hive OAuth
login, holds the hive token server-side (the browser only ever gets a session cookie), syncs the
species/move catalog, and does **all** stat math. The **web** SPA talks only to the api under `/api`,
never sees a hive token, and does filtering/sorting and type-matchup display client-side from vendored
reference data. Each tier's README covers its own internals; start there.

## Running the stack

Everything is defined in [`docker-compose.yml`](docker-compose.yml). Copy the env template first
(defaults boot the stack as-is):

```bash
cp .env.example .env
```

**Full stack in Docker** — web on `3050`, api on `5050`, db on `5437`:

```bash
docker compose up
```

**Local web dev against a containerised backend** — Vite dev server on `5173`, proxying `/api` to the
containerised api:

```bash
docker compose up pokedex-db pokedex-api
cd web && yarn dev
```

Pokedex uses the **3050 / 5050 / 5437** port band, reserved for it in the platform stack. On first
boot with an empty catalog the api runs one game-data sync in the background (best-effort — the app
still starts if the source is down; an admin can trigger it later). See [`.env.example`](.env.example)
for every knob (hive URLs, CORS origins, the game-data source URL, the `@rauboti/ui` package token).

## Where things live

- **Feature spec & design** — [`specs/001-pokemon-collection-tracker/`](specs/001-pokemon-collection-tracker/):
  `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/openapi.yaml`, `quickstart.md`, and
  `tasks.md`. The OpenAPI contract is the source of truth for the wire shape; the numbered `FR-xxx` /
  `SC-xxx` / `Dx` markers throughout the code trace back to it.
- **Project principles** — [`.specify/memory/constitution.md`](.specify/memory/constitution.md).
- **Backend** — [`api/README.md`](api/README.md).
- **Frontend** — [`web/README.md`](web/README.md).

> **Status.** Active feature: **Pokémon Collection Tracker**. Implemented so far: auth (hive BFF), the
> game-data catalog sync + post-sync staleness rescan, the full server-side stat engine (CP→level
> derivation with collision handling, projections, IV%), Pokémon CRUD, and the collection view
> (search-to-register dialog, client-side filter/sort, hundo highlight, IV stars). Planned: the
> Pokémon detail page (stats/projections/matchups/moves panels), the sync-time moveset ranker (a
> deliberate no-op seam today), and badges (US6). See `plan.md` for the full target.

## Contributing

Every implementation task gets a **fresh feature branch off `main`, created before any code**; agents
leave work uncommitted for review. No direct commits to `main`. The full rule (and the hook that
enforces it) is in [`CLAUDE.md`](CLAUDE.md).
