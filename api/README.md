# Pokedex API (BFF)

The Pokedex backend: a Kotlin + Spring Boot **Backend-for-Frontend**. It owns all collection data in
Postgres, brokers the hive OAuth login, syncs the species/move catalog, does **all** stat math, and
serves the SPA under `/api`. Package root `no.rauboti.pokedex`.

- **Kotlin on JDK 25**, Spring Boot **4.1** (Jackson 3 / `tools.jackson`).
- **Persistence: PostgreSQL via `JdbcClient`** — hand-written SQL, no JPA. Migrations via **Flyway**.
- **Build: Maven** via the `mvnw` wrapper. Formatting: Spotless driving the ktlint engine.

> **This README is the reference.** In-code comments are deliberately terse and cover only local,
> non-obvious decisions; the architecture, formulas, and invariants live here. Several classes point
> back at a named section below.

## Module map

```
no.rauboti.pokedex/
├── auth/            hive OAuth handshake + BFF session (PKCE, token client, session keys, /api/auth/me)
├── config/          security chain, offline JWT validation, session-token filter, hive endpoint paths
├── common/          RFC-7807 exceptions + the @RestControllerAdvice that renders them
├── stats/           pure math: CPM/dust tables, stat formulas, CP→level solver, projections
├── catalog/         catalog status + startup initializer
│   └── sync/        game-data client, normalizer, sync orchestration, staleness rescan
├── species/         species catalog read/write access + search endpoint
├── move/            moves, species pools, the moveset ranker, the species-moves endpoint
├── derivation/      the stateless CP→level preview endpoint
├── caughtpokemon/   the `caught_pokemon` row: repository, service, domain
└── pokemon/         Pokémon CRUD endpoints + the domain logic that enforces the write invariants
```

> **Divergence from plan.md.** The plan's Project Structure lists a single `gamedata/` package and folds
> derivation and the caught-Pokémon row into `pokemon/`. The tree above is what was actually built —
> sync lives under `catalog/sync/`, the ranker under `move/`, and `derivation/` + `caughtpokemon/` are
> their own packages. Worth reconciling into plan.md as an amendment.

## Endpoint surface

The OpenAPI contract (`specs/001-pokemon-collection-tracker/contracts/openapi.yaml`) is the source of
truth for the wire shape; this is the routing summary.

| Method | Path | Access |
|--------|------|--------|
| GET | `/auth/login`, `/auth/callback` | **public** — the browser-redirect OAuth handshake |
| GET | `/actuator/health` | **public** — the compose healthcheck |
| GET · POST | `/api/auth/me` · `/api/auth/logout` | any valid session, **no pokedex grant required** |
| GET | `/api/species?q=&limit=` | `user` or `admin` |
| GET | `/api/species/{id}/moves` | `user` or `admin` |
| POST | `/api/derivation` | `user` or `admin` |
| GET · POST | `/api/pokemon` | `user` or `admin` |
| GET · PATCH · DELETE | `/api/pokemon/{id}` | `user` or `admin` |
| GET | `/api/catalog` | `user` or `admin` |
| POST | `/api/catalog/sync` | **`admin` only** |

## Auth model (BFF)

Pokedex is a **consumer** of hive, never its own identity provider:

- `/auth/login` mints a CSRF `state` and a PKCE `code_verifier`, stores both server-side on the
  session, and redirects to hive with the S256 `code_challenge`. `/auth/callback` verifies `state`
  (timing-safe), spends the one-time material, exchanges the code, and stores **both** tokens on the
  session. The browser only ever receives the `POKEDEX_SESSION` cookie — HttpOnly, SameSite=Lax, and
  Secure in production via `SESSION_COOKIE_SECURE`.
- If the token exchange fails because hive is unreachable, the callback redirects back to the SPA with
  `?error=signin_unavailable` rather than rendering problem+json — mid-redirect, a 502 body would land
  as a raw error page.
- On every `/api` request, `SessionTokenAuthenticationFilter` decodes the session's access token as a
  hive-issued RS256 JWT, validated **offline** against hive's JWKS, and rebuilds the `SecurityContext`
  from its claims. The context is stateless — never persisted. An expired token is refreshed silently,
  server-side; if the refresh also fails the dead tokens are dropped and the request falls through to
  401, which the SPA turns into a fresh login.
- **Claim checks:** Spring's `exp`/`nbf` defaults, plus `iss` equal to `HIVE_EXTERNAL_URL` (hive stamps
  its external URL) and an `aud` containing `pokedex`.
- **Authorization:** `/api/**` needs a pokedex app role (`user` or `admin`) from the `roles` claim, so a
  signed-in hive user *without* a pokedex grant gets a **403** there. `/api/auth/**` needs only a valid
  session, so that user can still see they are signed in and sign out. Catalog sync is **admin-only**.
  Unauthenticated `/api` calls get a plain **401**, never a redirect.

Two hive base URLs matter: **external** (browser-reachable, and the expected `iss`) and **internal**
(container-reachable, for the token exchange and JWKS). See [`.env.example`](../.env.example).

## Schema

Four tables, created by `V1__create_catalog.sql` and `V2__create_caught_pokemon.sql`.

- **`move`** — one fast or charged move. `power`/`energy`/`duration_ms` are the ranker's inputs; `type`
  feeds STAB and matchup display. A fast move's `energy` is positive (generated), a charged move's is
  negative (cost).
- **`species`** — one species **+ form**; the `id` embeds the form discriminator (`RATTATA_ALOLA`) so it
  survives resyncs. `registrable = false` for megas and temporary battle forms. The two
  `recommended_*_move_id` FKs are written at sync time.
- **`species_move`** — which moves a species can know, with the `legacy` flag (legacy / Elite TM). A
  species' rows are replaced wholesale on each sync.
- **`caught_pokemon`** — the player's row. `user_id` is the hive `sub`, never exposed in responses.
  `level` is a *derived cache*, only ever written after solver confirmation. The move-slot FKs point at
  `move`, **not** `species_move`, so a recorded move survives leaving the pool.

Catalog rows are upserted by source `id` and **never deleted** — a form vanishing from the feed must not
invalidate existing collection rows. Everything else derived (HP, effective stats, IV%, projections) is
computed on read and never stored.

## Stat engine

`stats/` is pure Kotlin — no Spring — so the whole module is unit-tested directly, and the SC-002 sample
pins it against PvPoke and GO Hub.

```
CP        = max(10, floor((atk+ivA) · √(def+ivD) · √(sta+ivS) · cpm² / 10))
HP        = max(10, floor((sta+ivS) · cpm))
effective = (base + iv) × cpm                       (unfloored)
IV%       = round((ivA+ivD+ivS) / 45 × 100, 1dp)
```

The **CP→level solver** returns *every* half-step level whose computed CP matches the observed one.
Usually that is exactly one: CP is non-decreasing in level for fixed IVs. Multiple matches occur only on
the **CP=10 clamp plateau** at the lowest levels — a genuine collision the caller disambiguates. An
empty result means the (species, IVs, CP) combination is impossible.

**Collisions are disambiguated by level, not by dust.** The per-candidate stardust cost is an
informational hint only; it *ties* across the plateau where collisions actually happen. (This corrected
an earlier assumption — see the T016 amendment.)

**Projections** cover L40 and L50 always, plus a Best-Buddy row at current level + 1 when the flag is
set and that level is still on the table. Best Buddy never alters the stored level.

Reference data is **vendored** as classpath JSON in `resources/reference/`: the CPM table (the solver
wants it in memory) and the power-up stardust table.

## Catalog sync

`POST /api/catalog/sync` (admin) and one automatic run at startup when the catalog is empty. The startup
run is best-effort — an unavailable source must not stop the app from booting.

Stages, in order:

1. **Fetch** the feed (`{GAMEDATA_BASE_URL}/api/pokedex.json`) — behind a `GamedataClient` interface, so
   tests stub *this boundary* with MockK instead of an HTTP-level mock.
2. **Normalize** it — pure, unit-tested against committed fixture JSON. Deliberately defensive: a
   species or move missing a required field is **skipped**, because the source carries occasional
   placeholder entries. Only an unparseable or non-array root fails the whole feed.
3. **Upsert** inside one transaction, in FK order: moves → species → each species' pool replaced.
4. **Rank** each species' pool and store the winning pairing on the species row.
5. **Rescan staleness** across every caught Pokémon.

Steps 1–2 happen **outside** the transaction, which is the important property: a dead source or a
malformed feed raises before anything is written, so the catalog is left untouched. Point
`GAMEDATA_BASE_URL` at a stub to exercise those paths.

**Staleness rescan** (FR-013) re-derives every caught Pokémon against the refreshed base stats and flags
any whose stored `level` is no longer a solver candidate. Flagging is **monotonic** — the rescan only
ever sets `stale`; clearing it is a re-deriving edit's job, so a player's correction is never silently
undone by a later sync.

## Moveset ranking

The sync-time heuristic is **sustained cycle DPS**: spam a fast move to build energy, fire a charged
move, repeat. For each (fast, charged) pairing:

```
fastsPerCharge = ceil(energyCost / energyGain)
cycleMs        = fastsPerCharge · fastDurationMs + chargedDurationMs
cycleDamage    = fastsPerCharge · fastPower · STAB(fast) + chargedPower · STAB(charged)
dps            = cycleDamage / (cycleMs / 1000)
```

with **STAB = 1.2×** when a move's type matches one of the species' types. Highest DPS wins; ties keep
the first pairing in iteration order. Legacy / Elite-TM moves are ranked like any other pool move —
several canonical best answers (Swampert's Hydro Cannon) *are* legacy, so the UI marks them rather than
the ranker hiding them.

**Known calibration gap:** pure cycle DPS reliably reproduces the community-listed *charged* move but
not always the *fast* move. That is the heuristic research D8 specifies; the divergence is documented in
`MovesetRankerTest` rather than tuned away silently.

## Write invariants

`PokemonService` enforces all four on every write:

0. The species must be **registrable** — megas and temporary battle forms are rejected, on create and on
   a species change.
1. The solver must **confirm** (species, IVs, CP) → level. Ambiguous requires a chosen candidate from
   the list; no match at all is a 422.
2. Recorded moves must be **in the species' pool** and slot-correct (fast in the fast slot, charged in
   the charged slots).
3. An edit touching species / IVs / CP **re-derives** the level and clears `stale`. An edit touching
   only flags or the catch date does neither.

Every read is user-scoped. `CaughtPokemonRepository.findAll`/`markAsStale` are the two deliberate
cross-user exceptions, used only by the rescan.

## Errors

Domain exceptions render as RFC-7807 `application/problem+json` carrying a stable machine `code` that
the SPA keys on. Spring's own MVC exceptions render the same way, so the envelope is uniform.

| Status | Exception | Codes seen |
|--------|-----------|------------|
| 400 | `BadRequestException` | `invalid-ivs`, `invalid-cp`, `invalid-oauth-state` |
| 403 | `ForbiddenException` | — (sync is gated in the security chain) |
| 404 | `NotFoundException` | `unknown-species` |
| 422 | `UnprocessableException` | `impossible-combination`, `level-not-a-candidate`, `species-not-registrable`, `move-not-in-pool` |
| 502 | `HiveUnavailableException` | `hive-unavailable` |
| 502 | `GamedataUnavailableException` | `gamedata-unavailable` |

404 deliberately covers both "no such id" and "not yours" — the two are indistinguishable to a caller.

## Build, test, run

```bash
./mvnw verify          # compile, test, and run the Spotless check (the CI gate)
```

```bash
./mvnw test            # tests only
```

```bash
./mvnw spotless:apply  # auto-format Kotlin
```

Run against a containerised db (from the repo root — Flyway migrates on start):

```bash
docker compose up pokedex-db
```

```bash
cd api && ./mvnw spring-boot:run
```

**Testing** — JUnit 5, MockMvc + `spring-security-test`, MockK. Integration tests run against a real
Postgres via Testcontainers (so `verify` needs a Docker daemon; `docker build` therefore skips tests).
The game-data source is stubbed at the client interface with MockK plus committed fixture JSON — no
HTTP-level mock, matching every sibling app. The test profile sets `sync-on-startup: false` so the suite
never reaches the network.

## Conventions

- **`JdbcClient`, not JPA** — explicit hand-written SQL with **UPPERCASE keywords**, every read
  user-scoped (FR-014). (Migrations keep lowercase DDL.)
- **Comments stay minimal**; rationale belongs in this README. Where a comment earns its place it
  explains a local footgun — matcher ordering, a null-row quirk, an energy-sign convention.
- Spec traceability markers (`FR-xxx`, `SC-xxx`, `Dx`) are kept where they carry real provenance.
- `stats/` and `move/MovesetRanker.kt` must stay **Spring-free** so they remain directly unit-testable.
