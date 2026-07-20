# Implementation Plan: Pokémon GO Collection Tracker

**Branch**: `001-pokemon-collection-tracker` | **Date**: 2026-07-20 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-pokemon-collection-tracker/spec.md`

## Summary

Pokedex v1 lets a hive-authenticated player register their Pokémon GO catches
(species incl. forms, IVs, observed CP — with CP→level derivation, collision
disambiguation by dust cost, and impossible-input rejection), browse and
filter/sort the collection, spot hundos and project stats to L40/L50/Best Buddy,
read type matchups from the canonical chart, and record each Pokémon's moves
against a sync-computed optimal moveset. Technical approach: the platform-standard
two-tier shape — a Kotlin/Spring Boot BFF API owning all data in Postgres,
brokering hive OAuth, syncing species/move data from a community Game Master
source, and doing **all** stat math server-side (one authoritative solver,
verified against community calculators) — and a React SPA (`@rauboti/ui`) doing
filtering/sorting and type-matchup display client-side from vendored stable
reference data. Badges (US6, stretch) deferred. Full decisions in
[research.md](research.md).

## Technical Context

**Language/Version**: Kotlin 2.x on JDK 25 (api); TypeScript ~6.0 (web)

**Primary Dependencies**: Spring Boot 4.1 (web, security, oauth2-client,
oauth2-resource-server, jdbc, flyway starters), Maven `mvnw`, Spotless/ktlint;
Vite 8 + React 19 + Chakra UI v3 + `@rauboti/ui` (≥0.3.5) + React Router 7 + Zod.
No i18n, no charting — neither is required by this spec (research D4)

**Storage**: PostgreSQL 17 (`pokedex-db`), migrations via Flyway
(`flyway-database-postgresql`); vendored reference files outside the DB: CPM +
dust tables in api resources, type chart in web lib (research D6)

**Testing**: api — JUnit 5, MockMvc + `spring-security-test`, MockK,
Testcontainers (real Postgres), WireMock for the game-data source (research D5);
stat-math unit suite pins the SC-002 sample (≥10 Pokémon vs PvPoke/GO Hub) and
the SC-007 moveset sample; web — Vitest + React Testing Library + MSW; type-chart
unit tests pin the SC-006 sample

**Target Platform**: Docker Compose stack (platform monorepo); desktop + phone
browser (registration happens mid-game on a phone)

**Project Type**: Web application — `api/` + `web/` (platform convention)

**Performance Goals**: Registration flow <30 s (SC-001) — derivation preview is a
single stateless call iterating ≤101 levels (sub-ms); collection filter/sort at
1,000 rows <1 s client-side (SC-003); full game-data sync (~1,500 species-forms +
moves + pools) completes in <60 s and never blocks reads (research D5)

**Constraints**: Hive tokens never reach the browser (BFF, session cookie only);
per-user isolation enforced server-side on every query (FR-014); species base
stats and move data MUST be synced, never hardcoded (FR-011, constitution); no
unofficial player-data APIs — manual entry only (FR-012); CPM/dust/type-chart
vendored per constitution Game Data Constraints; impossible species/IV/CP inputs
rejected server-side (SC-004); post-sync staleness rescan flags rebalanced
Pokémon (FR-013/SC-005)

**Scale/Scope**: Handful of platform users; low thousands of Pokémon per user;
catalog ~1,500 species-forms, ~400 moves; 2 SPA pages (Collection, Pokémon
detail) + a registration dialog + auth shell; ~10 API endpoint groups
([contracts/openapi.yaml](contracts/openapi.yaml))

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Evidence |
|---|-----------|--------|----------|
| I | Spec-Driven Development | ✅ PASS | spec.md exists (amended 2026-07-20: PvP deferred, matchups+moves added); this plan derives from it; tasks will trace to its user stories |
| II | Test-First Verification | ✅ PASS | Test stack defined per tier (Technical Context); tasks.md will order test tasks before implementation; contract tests against openapi.yaml; SC-002's external-calculator sample (constitution Principle II's explicit math-verification demand) pinned in the api unit suite; sync client tested against WireMock fixtures |
| III | Human as Conductor | ✅ PASS | Work on feature branch increments (`001-pokemon-collection-tracker-usN`, created before code); agents leave work uncommitted; maintainer commits/merges. One owned cross-repo change (hive client registration, research D2) flagged for explicit maintainer approval |
| IV | Platform Citizenship | ✅ PASS | `pokedex/docker-compose.yml` is source of truth; services `pokedex-db`/`pokedex-api`/`pokedex-web`; host ports 3040/5040/5436 (constitution defaults, verified free); app-specific env in pokedex's own env files; stack-facing `pokedex.env` at platform root |
| V | Platform Building Blocks First | ✅ PASS | UI composed from `@rauboti/ui` (AppShell/Navbar, Card, Dialog, Input, Select, Badge, EmptyState, Callout, List, …); auth fully delegated to hive (BFF, JWKS validation); no bespoke components anticipated — matchup/stat displays compose Badge/Card primitives |
| VI | Simplicity First | ✅ PASS | Client-side filter/sort (no query endpoints); one game-data source; four tables; one simple moveset heuristic (spec assumption); no i18n/charts/OCR; deviations justified in Complexity Tracking |
| — | Game Data Constraints | ✅ PASS | No player-data APIs (manual entry, FR-012); base stats/moves synced with `synced_at` (FR-011, research D5); CPM + dust + type chart vendored (research D6) |

**Post-design re-check (after Phase 1)**: ✅ PASS — four pokedex tables (`species`,
`move`, `species_move` catalog + `caught_pokemon`), ten endpoints across four
groups (auth, catalog, species, pokemon), all stat math in one server-side module,
no server-side collection queries, no new infrastructure beyond the
platform-standard three services. The game-data sync module, derivation preview
endpoint, and vendored reference files are deliberate, documented deviations
(Complexity Tracking) rather than violations. Badges (US6/FR-018) explicitly
deferred per spec assumption.

## Project Structure

### Documentation (this feature)

```text
specs/001-pokemon-collection-tracker/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── openapi.yaml     # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
api/
├── src/main/kotlin/no/rauboti/pokedex/
│   ├── auth/            # BFF: hive OAuth client, session cookie, /api/auth/me, logout
│   ├── common/          # RFC-7807 errors, shared config
│   ├── config/          # Security filter chain, CORS
│   ├── stats/           # Pure math: CPM loader, CP/HP/stat formulas, CP→level solver, projections, IV% (research D7)
│   ├── gamedata/        # Sync client (WireMock-tested), normalizer, moveset ranker (research D8), staleness rescan (D9), catalog controller
│   ├── species/         # Species repository (JdbcTemplate), search + moves controllers
│   └── pokemon/         # CaughtPokemon entity, repository, service (derivation + write invariants), controllers (derivation preview + CRUD)
├── src/main/resources/
│   ├── application.yml / application-dev.yml / application-test.yml
│   ├── reference/cpm.json           # vendored (research D6)
│   ├── reference/dust.json          # vendored (research D6)
│   └── db/migration/V1__create_catalog.sql
│                    V2__create_caught_pokemon.sql
├── src/test/kotlin/no/rauboti/pokedex/   # unit (stats/, gamedata ranker) + contract (MockMvc) + integration (Testcontainers) tests
├── Dockerfile
├── mvnw / mvnw.cmd / pom.xml

web/
├── src/
│   ├── api/             # typed client for /api/species, /api/derivation, /api/pokemon, /api/catalog, /api/auth (Zod schemas)
│   ├── auth/            # session context, login redirect handling (research D12)
│   ├── components/
│   │   ├── layout/      # Navbar/app shell (@rauboti/ui)
│   │   ├── pokemon/     # RegisterDialog (SpeciesSearch → IV/CP fields → derivation preview → LevelPicker on collision), PokemonList, PokemonFilters, FlagBadges, hundo highlight
│   │   └── detail/      # StatsPanel (derived block), ProjectionsPanel (L40/L50/Best Buddy), MatchupPanel (type chart), MovesPanel (recorded vs recommended, legacy markers)
│   ├── lib/             # pure helpers: filtering, sorting, typeChart.ts + matchups (research D6/D10)
│   ├── pages/           # CollectionPage (default), PokemonDetailPage
│   ├── mocks/           # MSW handlers
│   └── test/            # test setup
├── Dockerfile / nginx.conf / vite.config.ts / package.json

docker-compose.yml       # pokedex-db + pokedex-api + pokedex-web (healthcheck-gated)
.env.example
```

**Structure Decision**: Two-tier web application (`api/` + `web/`) mirroring
avec/pulse exactly — same package root convention (`no.rauboti.pokedex`), same
frontend layout. New source folders vs. avec: api `stats/` (pure math module —
the app's core domain logic, kept Spring-free for direct unit testing against the
SC-002 sample) and `gamedata/` (persistent catalog sync, a deeper cousin of
avec's `lookup/` proxy); web `detail/` (the four detail panels). Client-side
`lib/` follows the avec/pulse pure-function precedent but deliberately contains
**no stat math** — that lives server-side only (research D7).

## Complexity Tracking

> Constitution Check passes; entries below justify the additions that go beyond
> what the sibling apps already use.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Game-data sync module persisting an external catalog (`gamedata/`: fetch → normalize → upsert `species`/`move`/`species_move`, startup-when-empty + on-demand trigger; research D5) | FR-011 forbids hardcoded base stats/moves; solver, FK integrity, moveset ranking, and rebalance detection all need the catalog locally | avec-style runtime proxy without persistence — rejected: every registration would depend on a third-party fetch, and FR-013's rescan needs a local before/after; raw Game Master parsing — the chosen source already normalizes it |
| Derivation preview endpoint (`POST /api/derivation`) in addition to create (research D7) | US1 scenario 4: the player must see and pick among colliding levels (with dust hints) *before* saving; preview keeps that stateless | Returning candidates as a 422 payload from `POST /api/pokemon` and re-posting — rejected: bends error semantics into a happy-path round trip and complicates the form's state machine |
| Vendored reference files in two tiers (CPM + dust in api resources, type chart in web lib; research D6) | Constitution mandates vendoring the CPM table; dust labels the collision candidates; the type chart drives a purely presentational view with three fixed multipliers | Everything in DB seed migrations — the solver wants CPM in memory and the web view would need a relay endpoint for a constant; fetching from pogoapi.net at runtime — network failure mode for data that effectively never changes |
| Sync-time moveset ranking stored on `species` (research D8) | FR-017 needs a recommended moveset; ranking depends only on synced move data, so sync is the natural (and only meaningful) recompute point | Computing per read — same result recomputed on every detail view; a community-rankings API — external dependency, and the spec fixed a simple owned heuristic instead |
