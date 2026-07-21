# Phase 0 Research: Pokémon GO Collection Tracker

Decisions below follow the platform convention of citing sibling-app research where a
decision is adopted rather than re-made (pulse `specs/001-*/research.md`, avec
`specs/001-beverage-collection/research.md`). "New" marks decisions specific to
pokedex.

## D1. Overall architecture — Backend-for-Frontend (adopted from pulse D1 / avec D1)

**Decision**: Two-tier platform-standard shape: a Kotlin/Spring Boot BFF API
(`pokedex-api`) owning all persistent data in Postgres and brokering hive OAuth
(session cookie to the browser, tokens never leave the server), plus a React SPA
(`pokedex-web`) served by nginx which proxies `/api` and `/auth` to the API so the
browser only talks to one origin.

**Rationale**: Identical to taskmaster, pulse, and avec — proven three times; keeps
hive tokens out of the browser and per-user isolation server-side (FR-014).

**Alternatives considered**: SSR framework (React Router framework mode per the
original brief sketch) — rejected: the platform template evolved to SPA + BFF and the
constitution (Principle IV/V) says follow the siblings; token-in-browser SPA-only —
rejected in pulse D1 for security.

## D2. Hive client registration for pokedex (owned cross-repo change)

**Decision**: Register a `pokedex` OAuth client in hive (client id `pokedex`, dev
secret `pokedex-local-dev`, redirect `http://localhost:3050/auth/callback` plus the
API-origin dev redirect), mirroring avec D2 minus the locale write-through — pokedex
is single-language and needs no hive user-attribute changes.

**Rationale**: Every platform app is a hive client; this is the same one-time
registration avec and pulse each did. No hive schema change needed this time.

**Alternatives considered**: Reusing another app's client id — rejected: per-app
`aud`/roles scoping is the hive convention; app-local accounts — forbidden by
constitution Principle V.

## D3. Backend stack (adopted from avec D3 / pulse D3)

**Decision**: Kotlin 2.x on JDK 25, Spring Boot 4.1 (web, security, oauth2-client,
oauth2-resource-server, jdbc, flyway starters), Maven `mvnw`, JdbcTemplate
repositories (no JPA), Flyway migrations, Spotless/ktlint. Tests: JUnit 5, MockMvc +
`spring-security-test`, MockK, Testcontainers Postgres, WireMock for the game-data
source client.

**Rationale**: Byte-for-byte the sibling stack; nothing in pokedex needs anything
newer or different.

**Alternatives considered**: none seriously — deviating requires justification under
Principle IV/VI and there is none.

## D4. Frontend stack (adopted from avec D4, minus i18n and charts)

**Decision**: Vite 8 + React 19 + TypeScript ~6.0, Chakra UI v3 with `@rauboti/ui`
(latest, ≥0.3.5) for all components where one exists, React Router 7 (library mode),
Zod for API response validation, Vitest + React Testing Library + MSW. English-only
UI; no charting dependency (nothing in the spec draws charts).

**Rationale**: Sibling template with the two avec extras (react-i18next, Highcharts)
dropped because this spec needs neither — Simplicity First.

**Alternatives considered**: Bilingual UI like avec — no requirement in the spec;
adding it speculatively violates YAGNI.

## D5. Game data source & sync (new)

**Decision**: Sync species and move data from the **pokemon-go-api.github.io** JSON
API (static GitHub Pages built from PokeMiners Game Master dumps; OpenAPI-documented).
One sync module in the API (`gamedata/`) fetches the full Pokédex feed, normalizes it
(species incl. regional forms/megas, base stats, types; fast/charged moves with
power/energy/duration; per-species move pools with legacy/Elite-TM markers), and
upserts into Postgres with a `synced_at` timestamp. Sync runs automatically at startup
when the catalog is empty and on demand via `POST /api/catalog/sync` — **admin-only**
(maintainer decision 2026-07-20: roles are `user` and `admin`; only `admin` triggers a
global sync); `GET /api/catalog` exposes last-sync time and counts for the "catalog
freshness" UI (spec edge case).

**Testing the sync (amended 2026-07-20 after maintainer review)**: platform precedent
check showed **no sibling app uses an HTTP-level mock** (no WireMock/MockWebServer in
hive, taskmaster, pulse, or avec's shipped code — all mock external HTTP clients at
the interface level with MockK, avec's `HiveTokenClient` pattern). Pokedex follows
suit and the maintainer's MockK preference: `GamedataClient` is an interface;
`GamedataNormalizer` is pure and tested against committed fixture JSON captured from
the real feed (covers deserialization without any HTTP server); `SyncService` tests
stub the client with MockK; the live source is exercised manually at the Phase 2
checkpoint. No new test dependency.

**Rationale**: FR-011 forbids hardcoding base stats/moves. This source is
purpose-built for exactly this data, needs no key, and being static is trivially
mockable. pogoapi.net remains the documented secondary source (CPM cross-check, dust
costs, badge definitions if US6 is ever picked up).

**Alternatives considered**: Parsing raw PokeMiners Game Master dumps — much larger
payloads and we'd own the normalization the API already does; runtime proxy without
persistence (avec's lookup pattern) — rejected: pokedex needs the catalog locally for
FK integrity, offline reads, moveset ranking, and rebalance detection (D9); scheduled
cron sync — deferred, on-demand + empty-catalog startup sync satisfies "best-effort
freshness" (spec assumption) with less machinery.

**Feed shape addendum (2026-07-21, captured during T010 from the live source)**:
- **Source base**: `https://pokemon-go-api.github.io/pokemon-go-api` (config
  `pokedex.gamedata.base-url`, env `GAMEDATA_BASE_URL`).
- **Full feed**: `GET {base}/api/pokedex.json` — a JSON **array** of species objects.
  (Per-id files exist at `{base}/api/pokedex/id/{dexNr}.json`; there is **no**
  top-level `moves.json` — `{base}/api/moves.json` returns 404. Move data is embedded
  per species.)
- **Species object** fields consumed: `id` (stable, e.g. `VENUSAUR`), `dexNr`,
  `names.English`, `stats.{attack,defense,stamina}`, `primaryType.type` /
  `secondaryType.type` (enum strings like `POKEMON_TYPE_GRASS`; normalized to a
  capitalized short name `Grass` by stripping the `POKEMON_TYPE_` prefix — no
  dependency on the per-language `names` map), `regionForms` (array of full species
  objects → each a registrable row, `dexNr` inherited from the parent), and
  `megaEvolutions` (object **keyed by id**, each `{id, names, stats, primaryType,
  secondaryType}` with **no moves** → each a **`registrable=false`** row, mega/temporary
  battle forms per clarification 2026-07-20).
- **Moves** live under four per-species collections: `quickMoves` (fast, pool
  `legacy=false`), `cinematicMoves` (charged, `legacy=false`), `eliteQuickMoves` (fast,
  `legacy=true`), `eliteCinematicMoves` (charged, `legacy=true`). Each is an object
  keyed by move id with `{id, names.English, type.type, power, energy, durationMs}`.
  **Quirk**: an *empty* elite collection serializes as `[]` (a JSON array), not `{}` —
  the normalizer treats any non-object collection as empty rather than failing.
- **Robustness**: the normalizer walks the tree defensively (Jackson tree model) —
  a species or move entry missing a required field is **skipped, not fatal**; a feed
  whose root is not a JSON array (or is unparseable) raises
  `GamedataUnavailableException` (→ 502). Committed fixture
  `api/src/test/resources/gamedata/pokedex-fixture.json` mirrors these shapes (incl.
  the `[]` empty-elite quirk, a mega, a regional form, and a malformed entry) for the
  pure normalizer test; the live feed is exercised manually at the Phase 2 checkpoint.

## D6. Vendored stable reference tables (new; constitution mandate)

**Decision**: Three stable tables are vendored into the repo, not fetched:
1. **CPM table** (levels 1.0–51.0 in half-steps) → `api/src/main/resources/reference/cpm.json`
   (constitution: Game Data Constraints requires vendoring this).
2. **Power-up dust costs** per level band → `api/src/main/resources/reference/dust.json`
   (used to label CP-collision candidates, US1 scenario 4).
3. **Type-effectiveness chart** (18×18, the three GO multipliers 1.6/0.625/0.390625
   mapped to "super effective / not very effective / immune-in-effect") →
   `web/src/lib/typeChart.ts` (drives the matchup view entirely client-side, D7).

Each file carries a source-URL comment (pogoapi.net / Game Master) and is covered by
unit tests pinning known values (e.g. CPM(40) = 0.7903, CPM(50) = 0.84029999).

**Rationale**: All three are stable game constants; fetching them adds a failure mode
for data that changes ~never. Splitting placement by consumer (math server-side,
matchup display client-side) avoids shipping the CPM table to the browser and avoids
an effectiveness endpoint that would just relay a constant.

**Alternatives considered**: Everything in the DB via seed migrations — the solver
reads CPM on every derivation and wants it in memory anyway; everything fetched from
pogoapi.net — pointless runtime dependency for constants.

## D7. Stat math & CP→level solver placement (new)

**Decision**: All stat math is **authoritative in the API**, as pure Kotlin in
`stats/` with no Spring dependencies: CP/HP/effective-stat formulas, IV%, the
CP→level solver (iterate 1.0…51.0 half-steps, respect the CP≥10 and HP≥10 floors,
return *all* matching levels), and projections (level 40, level 50, Best Buddy +1).
`POST /api/derivation` runs the solver statelessly so the registration form can show
level candidates (with dust-cost hints) *before* saving; `POST /api/pokemon` re-runs
it server-side and rejects inputs whose chosen level is not among the matches
(FR-003, SC-004). Pokémon DTOs carry the full derived block (level, HP, stats, IV%,
projections) so the web app does **zero** stat math — client-side `lib/` handles only
filtering/sorting (D10) and type matchups (D6.3).

**Rationale**: One implementation, one test surface for SC-002's
zero-discrepancy gate (unit tests pin ≥10 Pokémon verified against PvPoke and GO Hub,
including a CP-collision case and clamp cases). Derivation-before-save keeps the
disambiguation UX (US1 scenario 4) without provisional writes.

**Alternatives considered**: Math in the web app (avec puts aggregation client-side) —
rejected: persistence-integrity rules (reject impossible combos, staleness rescan)
must live server-side regardless, and duplicating the CPM table in two tiers doubles
the SC-002 verification surface; solver as SQL — untestable against the external
calculators.

## D8. Optimal moveset heuristic (new)

**Decision**: At sync time, compute per species a recommended moveset — the
fast+charged pairing from the species' full pool (legacy/Elite-TM included) that
maximizes **sustained cycle damage**: damage per second over repeated
fast-move → charged-move cycles using the moves' gym/raid power, energy, and duration
values, with the 1.2× STAB multiplier when the move's type matches the species.
Stored on the species row (`recommended_fast_move_id`, `recommended_charged_move_id`)
and returned with the move pool. The Pokémon detail view shows recorded vs recommended
and whether they match (FR-016/FR-017).

**Rationale**: Spec assumption fixes the bar: one simple, explainable heuristic —
not battle-sim rankings. Cycle DPS is the standard simple metric, computable from
synced move data alone, and matches community "best moveset" lists for well-known
species (SC-007 validates exactly that on ≥5 species). Legacy moves are included
because the canonical answers (e.g. Mud Shot / Hydro Cannon Swampert) are Elite-TM
moves — the UI marks them as not normally obtainable (US5 scenario 3).

**Alternatives considered**: PvPoke-style matrix simulation — out of scope by spec
assumption; excluding legacy moves — gives wrong answers for the very species users
check first; computing on every read — recomputation is only meaningful after a sync,
so sync time is the natural cache point.

## D9. Rebalance detection (new — FR-013)

**Decision**: `caught_pokemon` caches the derived `level` and carries a `stale`
flag. After every successful sync, the API re-runs the solver for all caught Pokémon
against the refreshed base stats: rows whose stored CP+IVs no longer produce their
cached level get `stale = true`; the collection and detail views badge them and
prompt re-entry; a successful edit (which re-derives, FR-010) clears the flag.

**Rationale**: SC-005 demands that no silently-wrong derived value survives a
rebalance. Recomputing at sync time (a rare, explicit event) keeps reads cheap and
the rule simple.

**Alternatives considered**: Deriving on every read and never caching — recomputes
forever to catch an event that happens rarely, and still needs a diff against "what
the user saw"; versioning base stats — history table for no spec requirement.

## D10. Collection filtering/sorting client-side (adopted from avec D9 / pulse precedent)

**Decision**: `GET /api/pokemon` returns the user's full collection; filtering
(species, type, flags) and sorting (IV%, CP, level, catch date, name) are pure
functions in `web/src/lib/` covered by Vitest.

**Rationale**: Spec assumes low-thousands of rows per user; sibling apps proved this
shape; SC-003 (1,000 rows < 1 s) is comfortably client-side territory. No query
endpoints to design, version, or test server-side.

**Alternatives considered**: Server-side filter/sort/paginate params — YAGNI at this
scale, rejected in avec D9 for the same reason.

## D11. Deployment & platform integration (adopted from pulse D8 / avec D10 + constitution)

**Decision**: `pokedex/docker-compose.yml` defines `pokedex-db` (postgres:17-alpine,
host 5437), `pokedex-api` (host 5050), `pokedex-web` (nginx, host 3050), healthcheck-
gated, with the `RAUBOTI_PACKAGE_TOKEN` BuildKit secret for the `@rauboti/ui`
registry at web build time. Platform root gets a `pokedex.env` (stack-facing HIVE_*
URLs) and an `include` entry in `platform/docker-compose.yml`. `.env.example`
documents app-local overrides.

**Rationale**: Constitution Platform Integration Constraints, verbatim; 3050/5050/5437
is the next free band.

**Alternatives considered**: none — this is the constitutionally mandated shape.

## D12. Session-expiry / hive-unavailable UX (adopted from taskmaster D11 / pulse D9 / avec D11)

**Decision**: 401 from any API call routes the SPA to the login redirect; hive
unreachable at login renders the standard "identity service unavailable" callout;
no partial anonymous mode.

**Rationale**: Platform-standard behavior, already designed and tested three times.

**Alternatives considered**: none.

## Scope note — badges deferred

US6 / FR-018 (badge tracking, stretch) is **deferred out of this implementation
plan**, as the spec's assumptions permit. No badge tables, endpoints, or UI are
designed in Phase 1; pogoapi.net's badge feed (D5) is the documented starting point
when it is picked up.

## Resolved unknowns

All Technical Context fields are concrete; no NEEDS CLARIFICATION markers remain.
The single owned cross-repo change (hive client registration, D2) is flagged for
explicit maintainer approval per Principle III.
