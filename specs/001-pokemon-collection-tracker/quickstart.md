# Quickstart: Pokémon GO Collection Tracker — validation guide

Runnable scenarios proving the feature end-to-end. Contracts:
[contracts/openapi.yaml](contracts/openapi.yaml); entities:
[data-model.md](data-model.md); decisions: [research.md](research.md).

## Prerequisites

- Docker (compose v2) — stack and Testcontainers
- JDK 25 + Maven wrapper (bundled) — api development
- Node 22 + yarn 4 — web development
- `RAUBOTI_PACKAGE_TOKEN` exported (or in `.env`) — `@rauboti/ui` registry access at web build time
- hive running (platform stack) with the `pokedex` client registered (research D2 — owned cross-repo change, maintainer-approved)

## Start the stack

```powershell
# from pokedex/ — copy and fill hive client secret etc.
cp .env.example .env
docker compose up --build
```

- Web: http://localhost:3040 · API: http://localhost:5040 · DB: localhost:5436
- In the combined platform stack instead: `docker compose up` from `platform/`
  (pokedex included via `pokedex.env` + `include` entry, research D11)
- First API start with an empty catalog triggers a game-data sync (research D5);
  `GET /api/catalog` shows counts + `syncedAt` when done

## Test suites (Constitution II gate — must be green before handover)

```powershell
# api: unit (formulas/solver/ranker) + contract (MockMvc) + integration (Testcontainers; needs Docker)
cd api; ./mvnw verify

# web: lint + unit/component tests (Vitest + RTL + MSW)
cd web; yarn lint; yarn test
```

The stat-math suite embeds the SC-002 verification sample: ≥10 Pokémon with expected
level/HP/stats cross-checked against PvPoke and GO Hub (sources cited in the test
file), including one CP-collision case and the CP/HP floor clamps.

## Scenario walkthroughs (map to spec user stories)

### US1 — Register a caught Pokémon (P1)

1. Sign in at http://localhost:3040 (hive redirect).
2. Register: search a species (try a form, e.g. "Rattata" → Alolan entry), enter
   IVs 15/15/15 and a valid CP → the form previews level, HP, stats, IV% 100%
   (via `POST /api/derivation`), and saving lists it with types visible.
3. Collision path: enter a low-stat species combination known to match two adjacent
   levels → the form shows both candidates with dust costs and requires a pick.
4. Impossible path: enter a CP no level can produce → save is blocked with an
   explanatory message; `POST /api/pokemon` (e.g. via curl) answers 422 (SC-004).
5. Flags: mark shadow → CP/HP shown unchanged, flag badge visible.

### US2 — Browse and filter the collection (P2)

1. Register a handful of Pokémon with distinct species/types/flags/IVs.
2. Filter by flag (shiny), by type (Dragon), by species — each shows exactly the
   matching subset; an unmatched filter shows the empty state.
3. Sort by IV%, CP, level, catch date, name — order flips as expected.
   All of it without network calls after load (client-side, research D10).

### US3 — Hundos and projections (P3)

1. The 15/15/15 Pokémon from US1 carries the hundo highlight in the list (FR-008).
2. Open its detail view → projections show CP/HP/stats at L40 and L50 (FR-009);
   values match a community calculator for the same species/IVs.
3. Flag it Best Buddy → a +1-level projection row appears.

### US4 — Type matchups (P4)

1. Open a single-type Pokémon's detail → weaknesses/resistances match the canonical
   type chart (spot-check one of each).
2. Open a dual-type with a double weakness (e.g. Fire/Flying vs Rock) → the double
   weakness is visually distinguished (SC-006 sample lives in the web unit tests).

### US5 — Moves vs optimal (P5)

1. On a well-known species (e.g. Swampert), record moves from the offered pool —
   only pool moves are offered; legacy/Elite-TM entries carry the marker.
2. The detail view shows recorded vs recommended moveset and a match/mismatch
   indicator; recommendation for the SC-007 sample species matches a trusted
   community list (pinned in api unit tests).
3. A Pokémon with no recorded moves shows the unrecorded state, not a guess.

### Cross-cutting — staleness after resync (FR-013 / SC-005)

1. With Pokémon registered, run `POST /api/catalog/sync` (or simulate a base-stat
   change in an integration test — the automated path).
2. Any Pokémon whose stored CP+IVs no longer match its cached level appears with the
   stale badge; editing (re-deriving) clears it.

### Cross-cutting — isolation & session (FR-014)

1. Sign in as a second hive user → empty collection; user A's Pokémon are not
   reachable by id (404).
2. Expire the session → next API call routes to login (research D12).
