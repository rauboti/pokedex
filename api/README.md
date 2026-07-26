# Pokedex API (BFF)

The Pokedex backend: a Kotlin + Spring Boot **Backend-for-Frontend**. It owns all collection data in
Postgres, brokers the hive OAuth login, syncs the species/move catalog, does **all** stat math, and
serves the SPA under `/api`. Package root `no.rauboti.pokedex`.

- **Kotlin on JDK 25**, Spring Boot **4.1** (Jackson 3 / `tools.jackson`).
- **Persistence: PostgreSQL via `JdbcClient`** — hand-written SQL, no JPA. Schema migrations via
  **Flyway**.
- **Build: Maven** via the `mvnw` wrapper. Formatting: Spotless driving the ktlint engine.

## Module map

```
no.rauboti.pokedex/
├── auth/       hive OAuth client + BFF session (login/callback, /api/auth/me, logout, PKCE)
├── config/     Security filter chain, offline JWT validation, session-token filter, CORS
├── stats/      Pure math: CPM/dust tables, CP/HP/stat formulas, CP→level solver, projections, IV%
├── gamedata/   Catalog sync (fetch → normalize → upsert), staleness rescan, catalog controller
├── species/    Species catalog read access (name search, move pool) — JdbcClient repositories
├── pokemon/    CaughtPokemon entity, repository, service (derivation + write invariants), controllers
└── common/     RFC-7807 error handling, shared API exceptions
```

## Auth model (BFF)

Pokedex is a **consumer** of hive, not its own identity provider (research D1):

- The `/auth/login` + `/auth/callback` handshake runs the OAuth Authorization-Code + PKCE dance
  against hive and **starts a server-side session**. Both the access and refresh tokens live in that
  session — they never reach the browser, which holds only a session cookie.
- On every `/api` request, `SessionTokenAuthenticationFilter` reads the session token, decodes it as a
  hive-issued RS256 JWT (validated offline against hive's JWKS), and refreshes it silently on expiry.
  The `SecurityContext` is stateless — rebuilt per request, never persisted.
- **Authorization:** `/api/**` requires a Pokedex app role (`user` or `admin`) from the token's
  `roles` claim; a signed-in hive user *without* a Pokedex grant gets a **403** there. The `/api/auth`
  endpoints (`me`, `logout`) need only a valid session, so that user can still see they're signed in
  and sign out. Catalog sync (`POST /api/catalog/sync`) is **admin-only** (spec assumption
  2026-07-20). The login handshake and `/actuator/health` are public. Unauthenticated `/api` calls get
  a plain **401** (no redirect) that the SPA turns into a hive login.

Two hive base URLs matter: **external** (how the browser reaches hive; also the expected token `iss`)
and **internal** (how the api container reaches hive for token exchange + JWKS). See `SecurityConfig`
and [`.env.example`](../.env.example).

## Stat engine & the game-data catalog

- **All stat math lives here, once.** `stats/` is pure Kotlin over base stats, IVs, and a CP
  multiplier: the GO stat formulas (`StatFormulas`), the **CP→level solver** (`LevelSolver` returns
  *all* half-step levels whose computed CP matches — usually one, several only on the low-level CP-floor
  plateau, a genuine collision the caller disambiguates), and projections. The web app does zero stat
  math (research D7). The solver's output is verified against community calculators in the unit suite
  (SC-002).
- **Write invariants are enforced on every write** (`PokemonService`, US1): the species must be
  registrable (megas/temporary forms rejected), the solver must confirm (species, IVs, CP) → a level
  (ambiguous needs a chosen candidate; no match is a 422, SC-004), and recorded moves must be in the
  species' pool and slot-correct. Editing species/IVs/CP re-derives the level and clears the `stale`
  flag.
- **The catalog is synced, not hardcoded** (`gamedata/`, research D5, FR-011). A sync fetches the
  community feed, normalizes it (`GamedataNormalizer` — pure, defensively skips malformed entries),
  and upserts `species` / `move` / `species_move` in FK order inside one transaction; the fetch and
  normalization happen *outside* the transaction, so a source failure leaves the catalog untouched.
  Sync runs on first boot when empty and on the admin `POST /api/catalog/sync`. After a sync commits,
  the **staleness rescan** re-derives every caught Pokémon against the refreshed stats and flags
  mismatches (`StalenessRescan`, FR-013). The sync-time moveset ranker is a deliberate no-op seam
  (T028).
- **Vendored reference data.** The CPM and stardust tables are committed JSON in `resources/reference/`
  (research D6) — the solver wants CPM in memory, and dust labels the collision candidates.

## Build, test, run

```bash
./mvnw verify          # compile, test, and run the Spotless check (the CI gate)
./mvnw test            # tests only
./mvnw spotless:apply  # auto-format Kotlin
```

Run the api locally against a containerised db (from the repo root):

```bash
docker compose up pokedex-db pokedex-api
```

**Testing** — JUnit 5, MockMvc + `spring-security-test`, MockK. Integration tests run against a real
Postgres via Testcontainers. The game-data source is mocked at the interface level with MockK +
committed fixture JSON (no HTTP-level mock; platform precedent, research D5 amendment). Contract tests
assert conformance to `contracts/openapi.yaml`; the stat-math suite pins the SC-002 external-calculator
sample.

## Conventions

- **`JdbcClient`, not JPA** — explicit hand-written SQL, **UPPERCASE keywords**, every read
  user-scoped (FR-014).
- The **OpenAPI contract**
  (`specs/001-pokemon-collection-tracker/contracts/openapi.yaml`) is the source of truth for the wire
  shape; the web mirrors it.
- Comment rationale references trace to the spec: `FR-xxx` (functional requirements), `Txxx` (tasks),
  `Dx` (research decisions), `SC-xxx` (success criteria).
