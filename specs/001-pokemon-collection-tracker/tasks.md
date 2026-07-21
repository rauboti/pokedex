---

description: "Task list for Pokémon GO Collection Tracker (Pokedex v1)"
---

# Tasks: Pokémon GO Collection Tracker

**Input**: Design documents from `/specs/001-pokemon-collection-tracker/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md

**Tests**: REQUIRED per Constitution Principle II — and **paired** (avec/pulse rhythm):
every task that writes failing tests also implements what greens them, inside the same
task. Within a task the order is strict: write the tests, observe them fail, implement,
observe green. Red never crosses a task boundary — **the full suite is green at every
task completion and every merge.** API contract tests use MockMvc +
`spring-security-test`; integration tests use Testcontainers; the game-data source is
mocked at the interface level with **MockK** + committed fixture JSON — no HTTP-level
mock, matching every sibling app (research D5 amendment 2026-07-20, maintainer
preference); web tests use Vitest + RTL + MSW. The stat-math suite embeds the SC-002
external-calculator sample (constitution Principle II's explicit math-verification
demand).

**Organization**: Tasks grouped by user story (US1 register, US2 browse/filter, US3
hundos + projections, US4 type matchups, US5 moves vs optimal). US6 (badges) is
**deferred** — no tasks. The game-data catalog (sync) is Foundational because every
story reads it; the staleness rescan (FR-013) lands with US1, which owns the data it
protects.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1–US5 — maps to spec.md user stories
- All paths are relative to `pokedex/` unless prefixed `../`

## Path Conventions

- **api**: `api/src/main/kotlin/no/rauboti/pokedex/`, tests in `api/src/test/kotlin/no/rauboti/pokedex/`
- **web**: `web/src/`, tests co-located `*.test.ts(x)`
- Mirrors avec/pulse layout (plan.md Structure Decision)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffolding for both tiers and the compose stack (research D3/D4/D11)

- [x] T001 Scaffold `api/`: Maven Spring Boot 4.1 Kotlin project mirroring `../avec/api/pom.xml` (starters: web, actuator, security, oauth2-client, oauth2-resource-server, jdbc, flyway + flyway-database-postgresql, postgres runtime; test: starter-test, spring-security-test, webmvc-test, MockK, spring-boot-testcontainers + testcontainers-postgresql; Spotless/ktlint; jackson-module-kotlin — the sibling dep set exactly, no HTTP-mock addition per research D5 amendment) — `api/pom.xml` (artifactId `pokedex-api`), `api/mvnw(.cmd)`, `api/.mvn/`, `api/src/main/kotlin/no/rauboti/pokedex/PokedexApplication.kt`, `api/src/main/resources/application.yml` + `application-dev.yml` + `application-test.yml` (5437 datasource, 3050 CORS/web defaults, `POKEDEX_SESSION` cookie, `pokedex.gamedata.base-url` env `GAMEDATA_BASE_URL` for D5), `api/Dockerfile`, `api/.dockerignore`, root `.gitattributes` (LF normalization — avec T001's Windows/ktlint lesson). Gate: `mvnw -B verify` BUILD SUCCESS on the empty project [done 2026-07-20 on branch `001-pokemon-collection-tracker-setup`: wrapper/.mvn/Dockerfile/.dockerignore + root `.gitattributes` copied verbatim from avec; pom adapted (artifactId `pokedex-api`, description; MockK comment extended to note it also stubs external HTTP clients per research D5 — dep set otherwise byte-identical to avec's); application.yml swaps in `pokedex.*` config keys incl. `pokedex.gamedata.base-url` (`GAMEDATA_BASE_URL`, default pokemon-go-api.github.io — exact API paths pinned in T010), 5437 datasource + 3050 CORS/web defaults, `POKEDEX_SESSION` cookie; comments re-pointed at pokedex task ids (T005/T007/T008/T009/T010/T031); application-test.yml notes the Testcontainers harness lands in T008 (avec's reach-ahead precedent). Root `.gitignore` (from specify init) already carried the full platform pattern set incl. `api/target/` — verified, no additions needed; `.specify/`/`.claude/` untracked matches avec's convention. Gate green: `mvnw -B verify` BUILD SUCCESS (7.9 s), Spotless clean on the 1 Kotlin file. AMENDED 2026-07-20 (branch `001-pokemon-collection-tracker-portfix`): port band moved 3040/5040/5436 → 3050/5050/5437 — tome's constitution had already claimed the 3040 band (constitution v1.0.2); application.yml datasource/CORS defaults updated, `mvnw -B verify` re-run green]
- [x] T002 [P] Scaffold `web/`: Vite 8 + React 19 + TS + Yarn 4 project mirroring `../avec/web/` (deps: @chakra-ui/react ^3.x, @emotion/react, @rauboti/ui ≥0.3.5, react-router ^7, zod; dev: vitest, @testing-library/*, msw, jsdom, eslint flat + prettier; **no i18next, no highcharts, no barcode-detector** — research D4) — `web/package.json` (`@pokedex/web`), `web/vite.config.ts` (proxy → :5050), `web/tsconfig*.json`, `web/index.html` (Pokedex title), `web/.yarnrc.yml.example`, `web/nginx.conf` (no camera policy needed), `web/Dockerfile` (BuildKit `rauboti_token` secret), `web/src/main.tsx` with `<ThemeProvider>` from @rauboti/ui. Gate: `yarn install` + `yarn build` + `yarn lint` + prettier clean (avec note: invoke as `corepack yarn …` in this Windows shell) [done 2026-07-20 on branch `001-pokemon-collection-tracker-setup` (same setup-increment branch as T001): configs (eslint flat, prettier, .nvmrc, .dockerignore, .yarnrc.yml.example, tsconfig.json/node, Dockerfile) copied verbatim from avec; package.json = avec's dep set renamed `@pokedex/web` minus i18next/react-i18next/highcharts(+react wrapper)/barcode-detector (research D4); tsconfig.app.json drops avec's `resolveJsonModule` (only needed for its i18n bundles); vite proxy → :5050, MSW comment re-pointed T010→T011; index.html title Pokedex (anti-FOUC script kept); **nginx Permissions-Policy back to pulse's fully-locked `camera=()`** — avec's `camera=(self)` was its scanner divergence, not applicable here; main.tsx is the minimal ThemeProvider shell (routing/auth/MSW land in T011/T012). Local gitignored `.yarnrc.yml` copied from avec for the registry token; `.yarnrc.yml.example` committed. Gate green: `corepack yarn install` (yarn 4.17, @rauboti/ui 0.3.6 resolved), `yarn build` (tsc -b + vite, 235 ms), `yarn lint` + prettier all clean; Chakra chunk-size warning noted, same as siblings. AMENDED 2026-07-20 (branch `001-pokemon-collection-tracker-portfix`): vite proxy target moved :5040 → :5050 with the port-band move (see T001 amendment), `yarn build` re-run green]
- [x] T003 [P] Compose stack: `docker-compose.yml` (services `pokedex-db` postgres:17-alpine host 5437, `pokedex-api` host 5050→8080, `pokedex-web` host 3050→80; healthcheck-gated; `rauboti_token` secret; HIVE_* + GAMEDATA_BASE_URL env passthrough per research D11) + `.env.example` (POSTGRES_*, HIVE_EXTERNAL_URL, HIVE_INTERNAL_URL, HIVE_CLIENT_ID=pokedex, HIVE_CLIENT_SECRET, WEB_BASE_URL=http://localhost:3050, CORS_ALLOWED_ORIGINS, GAMEDATA_BASE_URL). Gate: `docker compose config --quiet` OK [done 2026-07-20 on branch `001-pokemon-collection-tracker-compose`: mirrors avec's compose byte-for-byte with the pokedex names and the 3050/5050/5437 band (constitution v1.0.2 — 3040 band is tome's); the one addition vs avec is `GAMEDATA_BASE_URL` on `pokedex-api` (research D5) so failure-mode testing can point the catalog sync at a stub; `.env.example` mirrors avec's with a game-data section replacing the lookup section and the port-band comment listing tome. Gate green: `docker compose config --quiet` OK, services pokedex-db/pokedex-api/pokedex-web]
- [x] T004 [P] Platform stack integration (**touches `../docker-compose.yml` — platform file, explicit maintainer approval; left uncommitted in the platform repo**): add pokedex `include` entry + header-comment updates (port table gains pokedex 3050/5050/5437) to `../docker-compose.yml`, create `../pokedex.env` (stack-facing HIVE_EXTERNAL_URL=http://localhost:5000, HIVE_INTERNAL_URL=http://hive-api:8080), following the avec/pulse entries and env-isolation rules (Constitution IV). Gate: platform `docker compose config --quiet` OK, merged stack lists pokedex-db/api/web [done 2026-07-20 with explicit maintainer approval (given in the "do T003+T004" request): `include` entry + header updates (stack description, env-isolation example, port table listing pokedex 3050/5050/5437 with a note that 3040/5040/5436 is reserved by tome, sign-in line) in `../docker-compose.yml`; `../pokedex.env` mirrors avec.env (HIVE_EXTERNAL_URL localhost:5000, HIVE_INTERNAL_URL http://hive-api:8080). **Platform repo is separate — its change is left uncommitted there for the maintainer.** Gate green: platform `docker compose config --quiet` OK, merged stack lists all 15 services incl. pokedex-db/api/web]

**Checkpoint**: `docker compose config` valid; `yarn install` + `mvnw -q verify` (empty projects) succeed — green baseline established

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema, hive trust, error conventions, BFF auth, the game-data catalog, web API layer, SPA shell — no user story works without these

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 [P] Flyway migrations per data-model.md: `V1__create_catalog.sql` — `species` (id text PK, dex_nr int NOT NULL, name text NOT NULL, form text, base_atk/base_def/base_sta int NOT NULL CHECK > 0, type_1 text NOT NULL, type_2 text, registrable boolean NOT NULL default true — clarification 2026-07-20, recommended_fast_move_id/recommended_charged_move_id text FK→move, synced_at timestamptz NOT NULL) + index `(name)`, `move` (id text PK, name text NOT NULL, type text NOT NULL, is_fast boolean NOT NULL, power double precision NOT NULL CHECK >= 0, energy double precision NOT NULL, duration_ms int NOT NULL CHECK > 0, synced_at timestamptz NOT NULL), `species_move` (species_id FK→species + move_id FK→move composite PK, legacy boolean NOT NULL default false); `V2__create_caught_pokemon.sql` — `caught_pokemon` per data-model.md (id uuid PK default gen_random_uuid(), user_id text NOT NULL, species_id text NOT NULL FK→species, iv_atk/iv_def/iv_sta int NOT NULL CHECK BETWEEN 0 AND 15, cp int NOT NULL CHECK >= 10, level numeric(3,1) NOT NULL CHECK BETWEEN 1 AND 51, stale boolean NOT NULL default false, shiny/shadow/lucky/purified/best_buddy boolean NOT NULL default false, fast_move_id/charged_move_1_id/charged_move_2_id text FK→move, caught_at date, created_at/updated_at timestamptz NOT NULL default now()) + index `(user_id)`. Pulse/avec SQL idiom (lowercase DDL, named checks, `idx_` names). Schema proven green by story-phase Testcontainers tests; this task's own gate is a clean `mvnw verify` boot [done 2026-07-21 on branch `001-pokemon-collection-tracker-migrations`: two files under `api/src/main/resources/db/migration/`. V1 orders `move` → `species` → `species_move` (species carries the recommended-moveset FKs → move, research D8); every column, nullability, default and check matches data-model.md incl. `registrable` default true (clarification 2026-07-20) and `species_move` composite PK. V2 `caught_pokemon` full flag/IV/CP/level column set with named checks (IV BETWEEN 0 AND 15, cp >= 10, level BETWEEN 1 AND 51) and move-slot FKs → `move` (not `species_move`, so recorded moves survive a pool change); `id` uuid default `gen_random_uuid()` — PG17 core, no pgcrypto extension needed. avec idiom copied verbatim: lowercase aligned DDL, `-- TABLES`/`-- INDEXES` headers, `constraint <table>_<col>_check` names, `idx_<table>_<cols>` (`idx_species_name`, `idx_caught_pokemon_user`). Gate green: `mvnw -B verify` BUILD SUCCESS (6 s, Spotless clean, no DB-touching test yet — schema proof deferred to story-phase Testcontainers per design). Extra confidence beyond the gate: both migrations applied clean against a throwaway `postgres:17-alpine` via psql `ON_ERROR_STOP=1` — 4 tables, 10 named checks, 2 indexes, FKs + `gen_random_uuid()` all resolved]
- [x] T006 [P] Hive client registration for pokedex (research D2 — **cross-repo, Constitution III: prepared in `../hive`, left uncommitted for maintainer approval**): dev-seed the `pokedex` app (OAuth client id `pokedex` + sha256 dev-secret hash, redirect URI `http://localhost:3050/auth/callback`, origins 5173/3050, roles `user` + `admin`, audit `app.registered`), following exactly how avec was seeded (avec T006 (a) — **no schema/claim changes this time**, locale support already exists). Gate: hive suite green (`../hive: mvnw -B verify`) [done 2026-07-21, prepared in `../hive` on branch `chore/seed-pokedex` (hive's own per-increment branch + block-main hook; **left uncommitted there for maintainer review** — cross-repo, Constitution III), pokedex-side tasks.md annotation on `001-pokemon-collection-tracker-hive-client`: seed-only change to `../hive/api/src/main/resources/db/seed/R__demo_data.sql`, a POKEDEX block mirroring the AVEC block byte-for-byte in shape — app id `20000000-…-004` (next after avec's …003), name `Pokedex`, slug `pokedex`, description `Pokémon GO collection tracker.`, status active/system false, `allowed_origins {5173,3050}`, `redirect_uris {http://localhost:3050/auth/callback}`, `client_secret_hash 9f1b7a21…dfafb` = **verified** `sha256('pokedex-local-dev')` (the docker-compose `HIVE_CLIENT_SECRET` dev default; scheme confirmed by reproducing avec's committed hash from `sha256('avec-local-dev')`), created_at 2026-07-21; `app_roles` admin+user (admin desc notes catalog re-sync — sync is admin-only per spec assumption 2026-07-20); `app.registered` audit row id `30000000-…-008` dated 2026-07-21. No schema/claim/locale change (locale already exists). Gate green: `../hive` `mvnw -B verify` BUILD SUCCESS, **182 tests 0 failures**, Spotless clean — the dev/test profile loads `db/seed` into Testcontainers Postgres, so the green integration suite proves the new rows apply cleanly (UTF-8 `Pokémon` included) and break no existing hive test]
- [x] T007 [P] RFC-7807 error infrastructure, test-paired: write `common/ApiExceptionHandlerTest.kt` first (problem+json shape `{type, title, status, detail, code}` — fail), then `api/src/main/kotlin/no/rauboti/pokedex/common/ApiExceptionHandler.kt` + `ApiExceptions.kt` (`ApiException` base with stable `code`; `BadRequestException` 400, `NotFoundException` 404, `ForbiddenException` 403, `UnprocessableException` 422, `HiveUnavailableException` 502, `GamedataUnavailableException` 502; codes e.g. `impossible-combination`, `level-not-a-candidate`, `move-not-in-pool`, `unknown-species`, `gamedata-unavailable`), mirroring avec's common package (incl. its 422 divergence from pulse) → green [done 2026-07-21 on branch `001-pokemon-collection-tracker-error-infra`: three files under `common/`. `ApiExceptions.kt` = `ApiException` base (stable `code`, message→`detail`, optional cause) + the six the task lists — BadRequest 400, NotFound 404, Forbidden 403, **UnprocessableException 422** (pokedex's divergence: avec's actual common pkg has `ConflictException` 409, which pokedex has no use for — the contract uses 400/403/404/422/502, no 409; verified against contracts/openapi.yaml `UnprocessableInput` + the T016/T017 422 codes), HiveUnavailable 502, **GamedataUnavailable 502** (second upstream, research D5). `ApiExceptionHandler.kt` = `@RestControllerAdvice` mapping each to `ProblemDetail.forStatusAndDetail(...)` with `setProperty("code", …)` — byte-for-byte avec's shape plus the 422 + second-502 handlers. Test-paired: `ApiExceptionHandlerTest.kt` written first (referenced not-yet-existing symbols → guaranteed compile-red), plain unit test (no Spring context, avec precedent) asserting status/detail/code for all six incl. both 502s mapping distinctly by code (`hive-unavailable` vs `gamedata-unavailable`). Gate green: `mvnw -B verify` BUILD SUCCESS, **6 tests 0 failures**, Spotless clean. Note: openapi's `Problem` schema lists only {type,title,status,detail} as documented props but responses carry `code` as an RFC-7807 extension (matches avec + the T011 web Zod `Problem`)]
- [x] T008 Security config, test-paired: write `config/SecurityConfigTest.kt` (full-context chain, Testcontainers) + `config/JwtValidationTest.kt` + `config/SessionTokenAuthenticationFilterTest.kt` (unit) first — unauthenticated `/api/auth/me` and `/api/pokemon` → 401; JWT with empty/absent `roles` claim → 403; `ROLE_user` and `ROLE_admin` clear the chain identically; `/actuator/health` open; decoder validators (iss/aud=pokedex/exp — the aud check scopes hive's flat `roles` claim, avec T006 discovery); `roles`→`ROLE_*` mapping; silent-refresh filter behaviour (fail) — then implement `config/SecurityConfig.kt` + `JwtValidation.kt` + `SessionTokenAuthenticationFilter.kt` + `HiveEndpoints.kt` (NimbusJwtDecoder via JWKS `{HIVE_INTERNAL_URL}/.well-known/jwks.json`; `/api/**` gated `hasAnyRole("user","admin")`; stateless chain, CSRF disabled + SameSite=Lax HttpOnly `POKEDEX_SESSION` cookie; CORS from env; `/auth/{login,callback}` public, `/api/auth/**` authenticated), copying avec's four config files with pokedex names/props/audience; `support/TestcontainersConfiguration.kt` + `IntegrationTest.kt` land here (avec T008 reach-ahead precedent) → green [done 2026-07-21 on branch `001-pokemon-collection-tracker-security`: all four `config/` files mirror avec's with pokedex names/props/audience — `PokedexJwtAuthoritiesConverter`, `pokedexJwtValidator`, `POKEDEX_AUDIENCE="pokedex"`, props `pokedex.hive.{external,internal}-url` + `pokedex.cors.allowed-origins`, data-API probe `/api/pokemon` (lands T017). Two pokedex-specific trims vs avec: `HiveEndpoints` drops `ME_LOCALE_PATH` and `SessionKeys` drops `LOCALE` (no i18n — research D4). Cookie hardening (`POKEDEX_SESSION` HttpOnly/SameSite=Lax/Secure) was already in application.yml (T001), so no config change. Reach-aheads, all minimal (avec T008 precedent): `support/TestcontainersConfiguration.kt`+`IntegrationTest.kt` (`postgres:17-alpine` pinned) and `auth/SessionKeys.kt`+`auth/HiveTokenClient.kt` **interface-only** (+`HiveTokens`) since the filter compiles against them — the RestClient impl stays in T009; `SecurityConfigTest` carries a nested `@Primary` mockk `StubHiveTokenClient` (never invoked; keeps winning once T009's `@Component` exists, so T009 needn't touch the test). `JwtValidationTest` covers both empty-list and absent `roles` cases. Tests observed red first (unresolved references), then green: `mvnw -B verify` BUILD SUCCESS, **22 tests 0 failures** (6 jwt + 5 filter + 5 full-context + T007's 6), Spotless clean. BONUS: the full-context boot Flyway-migrated the Testcontainers Postgres — V1/V2 proven to execute in-suite (Flyway log: "Successfully applied 2 migrations … now at version v2"), reinforcing T005's out-of-band psql check]
- [x] T009 Auth BFF, test-paired (depends on T008): write `auth/LoginFlowTest.kt` (login redirect + S256/state; callback happy path with mocked `HiveTokenClient`; bad-state → 400; logout → 204; hive-unavailable → redirect `?error=signin_unavailable`) + `auth/AuthenticatedUserTest.kt` (me 401 unauthenticated; claims → `{sub, name, roles}` projection per contracts/openapi.yaml) first (fail) — then implement `auth/AuthController.kt` + `Pkce.kt` + `AuthenticatedUser.kt` + `HiveTokenClient.kt` + `SessionKeys.kt` (`/auth/login`, `/auth/callback`, `POST /api/auth/logout`, `GET /api/auth/me`), copied from avec minus the locale machinery → green [done 2026-07-21 on branch `001-pokemon-collection-tracker-auth`: `AuthController` (login/callback/logout/me) + `Pkce` + `AuthenticatedUser` copied from avec minus ALL locale machinery — no `LocaleRequest`/`updateLocale`/`PUT /api/auth/me/locale`, no `HiveMeClient`, no `SUPPORTED_LOCALES`, no `SessionKeys.LOCALE` (research D4, no i18n). Key divergence: the contract `Me` is `{sub, name, roles[]}` (openapi, required sub+name) not avec's `{name, role, locale}` — so `AuthenticatedUser` carries the flat `roles` list (not a single strongest role) + `sub`, and `me(jwt)` needs no session param (nothing session-derived without locale). `sub = requireNotNull(jwt.subject)` (fail-loud — a validated hive token always carries it; `jwt.subject` is a nullable platform type). `SessionKeys` (T008 seam) already had no LOCALE; `HiveTokenClient.kt` gained the production `RestClientHiveTokenClient` `@Component` (was interface-only from T008) — props `pokedex.hive.{internal-url,client-id,client-secret}`, exchange/refresh via `POST {internal-url}/oauth2/token`, `client_secret_post`, failures → `HiveUnavailableException("hive-unavailable")`; `@Value` (not `@param:Value`) on the non-property `internalUrl` ctor param to avoid a redundant-target warning. As T008's `SecurityConfigTest` predicted, its `@Primary` mockk stub still wins so T009 didn't touch that test; `LoginFlowTest` is standalone MockMvc with a mockk `HiveTokenClient`, `AuthenticatedUserTest` is full-context (now resolves the real `RestClientHiveTokenClient`, never invoked). Tests observed red first (unresolved refs / a `String?`-vs-`String` sub compile error caught + fixed), then green: `mvnw -B verify` BUILD SUCCESS, **30 tests 0 failures** (5 login + 3 me + prior 22), Spotless clean, no compiler warnings. Login round-trip against live hive deferred to the Phase 2 checkpoint (needs the T006 hive branch merged + stack up)]
- [ ] T010 [P] Game-data sync, test-paired (research D5, MockK-only per its 2026-07-20 amendment — no new test dep): write `gamedata/GamedataNormalizerTest.kt` (pure, against committed fixture JSON captured from the real pokemon-go-api.github.io feed — record source URLs as a dated addendum in research.md D5: species incl. regional/mega forms with stable ids, base stats, types; **mega/temporary battle forms flagged `registrable=false`** (clarification 2026-07-20); fast/charged moves with power/energy/duration; per-species pools with legacy/Elite-TM markers; malformed entries skipped, not fatal) + `gamedata/SyncServiceTest.kt` (Testcontainers + **MockK-stubbed `GamedataClient`**: full sync upserts species/move/species_move with `synced_at`; re-sync updates changed base stats in place; pool rows replaced per species in one transaction; species rows never deleted; client failure → `GamedataUnavailableException`, catalog unchanged) + `gamedata/CatalogApiTest.kt` (`GET /api/catalog` → counts + syncedAt + **caller-scoped** stalePokemonCount 0 (contract note — the count only ever covers the caller's own rows); `POST /api/catalog/sync` → 200 refreshed status as **admin**; **`user` role → 403** (admin-only, spec assumption 2026-07-20); 502 problem+json when source down; 401) first (fail) — then implement `gamedata/GamedataClient.kt` (interface + RestClient impl, timeout, identifying User-Agent — live source exercised at the Phase 2 checkpoint, avec T009 precedent) + `GamedataNormalizer.kt` + `SyncService.kt` (@Transactional; startup-when-empty via ApplicationReadyEvent; recommended-moveset hook left as a no-op seam until T028) + `CatalogController.kt` (sync gated `hasRole("admin")`) + catalog repositories (JdbcClient upserts for species/move/species_move) → green
- [ ] T011 [P] Web API layer: `web/src/api/schemas.ts` (Zod per contracts/openapi.yaml: Species, Move, SpeciesMoves, DerivationRequest/Result, Derived incl. projections, Pokemon with nested flags/moves/derived + stale, PokemonInput/Patch, CatalogStatus, Me, Problem with `code`) + `web/src/api/client.ts` (searchSpecies, getSpeciesMoves, derive, listPokemon, createPokemon, updatePokemon, deletePokemon, getCatalog, triggerSync, me, logout; avec's `getMe(options)` bootstrap-probe pattern) + MSW base handlers `web/src/mocks/handlers.ts` (fixture species incl. one dual-type + one form + one double-weakness combo, moves with legacy entries, in-memory pokemon store, derivation handler returning 1/2/0 candidates by fixture CP) + `mocks/{server,browser,fixtures}.ts` + `web/src/test/setup.ts` — pure infrastructure consumed by every later web test; gate: `yarn build` + lint clean, `vitest run --passWithNoTests` exits clean
- [ ] T012 Web shell, test-paired (depends on T009, T011): write `web/src/auth/AuthContext.test.tsx` + `web/src/auth/RequireAuth.test.tsx` first — 401 from `/api/auth/me` → sign-in screen; 403/no role → "no access to Pokedex" screen; authenticated → navbar with user name + sign-out (fail) — then implement `web/src/auth/AuthContext.tsx`, `LoginScreen.tsx`, `RequireAuth.tsx`, `NoAccessScreen.tsx`, `web/src/components/layout/RootLayout.tsx` (@rauboti/ui AppShell + Navbar: **Collection** `/`; user menu with Sign out via `signOutLabel`), `web/src/routes.tsx` (`/` CollectionPage, `/pokemon/:id` PokemonDetailPage placeholder) + placeholder `pages/{CollectionPage,PokemonDetailPage}.tsx`, `main.tsx` wiring — avec's shell minus i18n (English strings inline) → green

**Checkpoint**: Foundation ready — `mvnw verify` and `yarn test --run` green; login round-trip works against local hive; `POST /api/catalog/sync` fills the catalog from the live source (manual smoke)

---

## Phase 3: User Story 1 - Register a caught Pokémon (Priority: P1) 🎯 MVP

**Goal**: A player searches a species (incl. forms), enters IVs + observed CP, sees the derived level/HP/stats/IV%/types (with CP-collision disambiguation by dust cost and impossible-input rejection), saves with nickname/flags/catch date — and the stored collection survives rebalances via the staleness rescan (FR-001–FR-005, FR-010 api, FR-013)

**Independent Test**: Register a Pokémon with known species/IVs/CP and verify the derived values against community calculators; collision case forces a pick; impossible case is rejected; a second user sees nothing (quickstart US1)

> Every task below is test-paired: tests written first inside the task, red observed, implementation greens them before the task closes.

- [ ] T013 [P] [US1] Vendored reference data + stat math, test-paired: vendor `api/src/main/resources/reference/cpm.json` (levels 1.0–51.0 half-steps) and `reference/dust.json` (dust per level band), each with a source-URL comment (research D6); write `stats/CpmTableTest.kt` (pins CPM(1)=0.094, CPM(40)=0.7903, CPM(50)=0.84029999, CPM(51)=0.84529999; 101 entries; dust bands complete) + `stats/StatFormulasTest.kt` (CP formula incl. floor-10 clamp, HP incl. floor-10 clamp, effective stats, IV%) + `stats/LevelSolverTest.kt` — **the SC-002 gate**: ≥10 real Pokémon with expected level/HP/stats cross-checked against PvPoke and GO Hub (sources cited in the test file), including one CP-collision case returning both levels, clamp cases returning valid results, and **one Best-Buddy boosted-CP case** (CP observed while boosted resolves to base level +1 within the 1.0–51.0 range — spec edge case, analyze C1); solver returns ALL matching levels 1.0–51.0; impossible combination → empty + `stats/ProjectionsTest.kt` (L40/L50/Best-Buddy(+1) CP/HP/stats for a verified sample) first (fail) — then implement `stats/CpmTable.kt` (classpath loader) + `stats/DustTable.kt` + `stats/StatFormulas.kt` + `stats/LevelSolver.kt` + `stats/Projections.kt` — pure Kotlin, zero Spring imports (research D7) → green
- [ ] T014 [P] [US1] Species search, test-paired: write `species/SpeciesRepositoryTest.kt` (Testcontainers; seed rows directly via JdbcClient — sync not required: case-insensitive substring match on name, forms included, **`registrable=false` rows never returned** (clarification 2026-07-20), limit honored, ordered dex_nr then form) + `species/SpeciesApiTest.kt` (`GET /api/species?q=` → Species array per contract incl. `types` assembled from type_1/type_2; a mega-form fixture absent from results; missing/blank q → 400; limit cap 50; 401) first (fail) — then implement `species/Species.kt` + `species/SpeciesRepository.kt` (JdbcClient) + `species/SpeciesController.kt` → green
- [ ] T015 [P] [US1] CaughtPokemon domain + repository, test-paired: write `pokemon/CaughtPokemonRepositoryTest.kt` (Testcontainers: insert/list/find/update/delete round-trip joining species; user-scoping on every read; V2 constraints reject IV 16 / CP 9 at the DB layer; `stale` flag round-trips; move-slot FKs nullable) first (fail) — then implement `pokemon/CaughtPokemon.kt` + `pokemon/CaughtPokemonRepository.kt` (JdbcClient: insert, listByUser, findByIdAndUser, update, delete, plus `listAll` + `markStale(ids)` for T018's rescan) → green
- [ ] T016 [US1] Derivation preview API, test-paired (depends on T013, T014): write `pokemon/DerivationApiTest.kt` first — `POST /api/derivation` per contract: unique match → one candidate with level/hp/stats/dustCost; collision fixture → two candidates with differing dustCost; impossible → `{candidates: []}`; unknown speciesId → 404 `unknown-species`; IV out of range / CP < 10 → 400; 401 (fail) — then implement `pokemon/DerivationController.kt` (+ `pokemon/DerivationService.kt` bridging species repo + stats module) → green
- [ ] T017 [US1] Pokémon CRUD API, test-paired (depends on T013–T015): write `pokemon/PokemonCreateApiTest.kt` (`POST /api/pokemon` 201 with full derived block incl. projections + `perfect` on a 15/15/15; unambiguous input needs no `level`; collision without `level` → 422 `level-not-a-candidate` listing candidates in detail; collision with a candidate `level` → 201; impossible → 422 `impossible-combination` — SC-004; **non-registrable (mega) species → 422 `species-not-registrable`** on create and species change (data-model invariant 0, clarification 2026-07-20); flags persist; shadow changes nothing in derived values; unknown species → 404; 401/403) + `pokemon/PokemonListApiTest.kt` (caller's rows only — FR-014/user-B isolation; derived block recomputed on read; Best-Buddy rows carry the extra projection; **`GET /api/pokemon/{id}`** → 200 own row with derived block, 404 other-user/unknown — analyze C2) + `pokemon/PokemonUpdateDeleteApiTest.kt` (PATCH partial semantics per contract; IV/CP/species change re-derives + clears `stale`; move fields validated against the species pool + fast/charged slot correctness → 422 `move-not-in-pool` (write invariant 2 — pool seeded directly in the test); DELETE 204; 404 for other-user/unknown id, indistinguishable) first (fail) — then implement `pokemon/PokemonService.kt` (solver confirmation, write invariants 1–3 from data-model.md, DTO assembly with derived block) + `pokemon/PokemonController.kt` + `pokemon/PokemonInput.kt` per contracts/openapi.yaml; `user_id` = hive `sub` → green
- [ ] T018 [US1] Staleness rescan, test-paired (depends on T013, T015; closes the T010 no-op seam for rescan): write `gamedata/StalenessRescanTest.kt` first (Testcontainers: registered Pokémon + a sync that changes its species' base stats → row flagged `stale=true`; unaffected rows untouched; `GET /api/catalog` stalePokemonCount reflects it; a re-deriving PATCH clears the flag — FR-013/SC-005 end-to-end) (fail) — then implement `gamedata/StalenessRescan.kt` (after each successful sync: re-run solver per caught row against refreshed stats, `markStale` mismatches) wired into `SyncService.kt` → green
- [ ] T019 [US1] Register dialog, test-paired (depends on T011, T012): write `web/src/components/pokemon/RegisterDialog.test.tsx` first — species autocomplete via searchSpecies (forms listed, types shown); IV steppers clamped 0–15, CP field ≥ 10; on complete input calls `derive` and previews level/HP/stats/IV%; collision fixture → LevelPicker radio with dust-cost labels, save blocked until picked; impossible fixture → explanatory message, save blocked (SC-004 client side); flags (shiny/shadow/lucky/purified/Best Buddy) + catch date optional (no nickname — spec assumption 2026-07-20); Best-Buddy flag shows a hint that a CP read while boosted derives the boosted (+1) level; save posts wire-shaped PokemonInput incl. picked level (fail) — then implement `web/src/components/pokemon/RegisterDialog.tsx` + `SpeciesSearch.tsx` + `LevelPicker.tsx` (@rauboti/ui Dialog/Input/Select/Badge) → green
- [ ] T020 [US1] Collection page v1, test-paired (depends on T019): write `web/src/pages/CollectionPage.test.tsx` first — list renders each Pokémon with species name/form, level, CP, IV%, types, flag badges (derived values straight from the DTO — no client math); register round-trip adds a row; spinner while loading; Callout on failure; catalog freshness line from `getCatalog` (syncedAt + "not synced yet" state — spec edge case) (fail) — then wire `web/src/pages/CollectionPage.tsx` (typed client list/create + PageHeader with Register trigger + `components/pokemon/PokemonList.tsx` + `FlagBadges.tsx`; MSW dev-store from T011) → green

**Checkpoint**: MVP — a hive user registers Pokémon and reads their full derived picture end-to-end, math verified against community calculators, rebalance-safe; both suites green (quickstart US1 walkthrough passes)

---

## Phase 4: User Story 2 - Browse and filter the collection (Priority: P2)

**Goal**: Filter by species/type/flags, sort by IV%/CP/level/catch date/name, edit and delete entries — all client-side over the full collection (FR-006–FR-008 list side, FR-010 UI)

**Independent Test**: Register a varied set, verify each filter/sort combination returns exactly the expected subset in order, empty-filter state shows, edit re-derives, delete removes (quickstart US2)

- [ ] T021 [P] [US2] Filter/sort helpers, test-paired: write `web/src/lib/filterPokemon.test.ts` (species substring, type membership incl. dual-types, each flag predicate, stale predicate, composable) + `web/src/lib/sortPokemon.test.ts` (IV% / CP / level / caught date (nulls last) / **species name** (form tiebreak — nicknames unsupported, spec assumption); ascending + descending; stable) first (fail) — then implement `web/src/lib/filterPokemon.ts` + `web/src/lib/sortPokemon.ts` (pure functions over the Pokemon DTO — research D10) → green
- [ ] T022 [P] [US2] Filters + list presentation, test-paired: write `web/src/components/pokemon/PokemonFilters.test.tsx` first — species text input, type Select (18 types), flag toggles, sort Select + direction; emits filter/sort state; active filters visible; also list additions in `PokemonList.test.tsx`: type badges, stale badge ("re-check" affordance groundwork for FR-013 UX), EmptyState when filters match nothing vs when collection is empty (fail) — then implement `web/src/components/pokemon/PokemonFilters.tsx` (@rauboti/ui Input/Select/SegmentedControl) + list presentation updates → green
- [ ] T023 [US2] Edit & delete flows, test-paired (depends on T021, T022): write edit/delete additions to `CollectionPage.test.tsx` + `RegisterDialog.test.tsx` first — edit opens the dialog prefilled; changing IVs/CP re-runs the derivation preview (collision picker reappears when applicable) and PATCHes; the purification walkthrough (edit IVs/CP + set purified flag) works as one edit (spec assumption); stale rows offer "re-enter" opening the same edit flow, successful save clears the badge; delete asks confirmation → DELETE + row gone; SC-003 sanity: filter+sort a 1,000-row fixture in a test under 1 s (fail) — then wire edit/delete through `CollectionPage.tsx` (filterPokemon + sortPokemon applied; client.update/delete; MSW handlers extended) → green

**Checkpoint**: US1 + US2 — the tracker is browsable and maintainable at collection scale; both suites green (quickstart US2 walkthrough passes)

---

## Phase 5: User Story 3 - Perfect-IV tracking and level projections (Priority: P3)

**Goal**: Hundos highlighted in the list; a detail view with current stats and L40/L50/Best-Buddy projections (FR-008, FR-009)

**Independent Test**: A 15/15/15 Pokémon is visibly highlighted; the detail projections match community calculators; Best Buddy adds the +1 row (quickstart US3)

- [ ] T024 [P] [US3] Hundo highlight, test-paired: write highlight additions to `PokemonList.test.tsx` first — `derived.perfect` rows carry a distinct visual marker (badge/accent) in the list; IV% 100.0 shown; non-perfect rows unmarked (fail) — then implement in `web/src/components/pokemon/PokemonList.tsx` (@rauboti/ui Badge, sparing accent per library convention) → green
- [ ] T025 [US3] Detail page: stats + projections, test-paired: write `web/src/pages/PokemonDetailPage.test.tsx` + `web/src/components/detail/{StatsPanel,ProjectionsPanel}.test.tsx` first — route `/pokemon/:id` refetches via `GET /api/pokemon/{id}` (client method + MSW handler added here — analyze C2); StatsPanel shows level, CP, HP, effective stats, IV breakdown + IV%, types, flags; ProjectionsPanel renders the L40/L50 rows and the Best-Buddy row exactly when flagged (values straight from `derived.projections` — no client math); unknown id → NotFound state; navigation from list row → detail (fail) — then implement `web/src/pages/PokemonDetailPage.tsx` + `web/src/components/detail/StatsPanel.tsx` + `ProjectionsPanel.tsx` (@rauboti/ui Card/List/Badge) and make list rows link → green

**Checkpoint**: US1–US3 — hundo hunting and power-up planning work; both suites green (quickstart US3 walkthrough passes)

---

## Phase 6: User Story 4 - Type matchups and weaknesses (Priority: P4)

**Goal**: Defensive weaknesses/resistances from the species' type(s) with dual-type stacking, plus offensive super-effective coverage — entirely client-side from the vendored chart (FR-015)

**Independent Test**: A single-type and a dual-type (incl. a double weakness) match the canonical type chart exactly (quickstart US4)

- [ ] T026 [P] [US4] Type chart + matchup lib, test-paired: write `web/src/lib/typeChart.test.ts` + `web/src/lib/matchups.test.ts` first — **the SC-006 gate**: 18 attack types × a sample defender set with zero discrepancies vs the canonical chart; GO multipliers (1.6 / 0.625 / 0.390625) mapped to buckets (weak / resist / double-weak / double-resist / immune-in-effect); dual-type stacking multiplies (Fire/Flying vs Rock → 2.56×; vs Ground → 0.390625×… as per chart); offensive coverage lists super-effective targets per attacking type, and accepts an optional set of recorded-move types kept distinct from the STAB set (US5 scenario 5 groundwork) (fail) — then implement `web/src/lib/typeChart.ts` (vendored 18×18 matrix with source comment — research D6) + `web/src/lib/matchups.ts` (pure: `defensiveMatchups(types)`, `offensiveCoverage(types, moveTypes?)`) → green
- [ ] T027 [US4] MatchupPanel, test-paired (depends on T025, T026): write `web/src/components/detail/MatchupPanel.test.tsx` first — weak/resist groups rendered from `matchups.ts` with double-weakness visually distinguished from single (SC-006's UI half); offensive "strong against" section from the species' own type(s) (STAB perspective — spec assumption); type names rendered as badges (fail) — then implement `web/src/components/detail/MatchupPanel.tsx` wired into `PokemonDetailPage.tsx` → green

**Checkpoint**: US1–US4 — battle-prep matchup reading works; both suites green (quickstart US4 walkthrough passes)

---

## Phase 7: User Story 5 - Move tracking and optimal moveset (Priority: P5)

**Goal**: Record fast/charged moves restricted to the species pool (legacy/Elite-TM marked), compare against the sync-computed optimal moveset (FR-016, FR-017; move validation already enforced by T017)

**Independent Test**: Moves offered come only from the pool with legacy markers; recommendation for well-known species matches community lists; match/mismatch indicator correct; unrecorded state honest (quickstart US5)

- [ ] T028 [US5] Moveset ranker + species-moves API, test-paired (closes the T010 ranker seam): write `gamedata/MovesetRankerTest.kt` first — **the SC-007 gate**: cycle-DPS ranking (sustained fast→charged cycle damage over duration, STAB ×1.2 when move type matches a species type — research D8) reproduces the community-listed best moveset for ≥5 well-known species (e.g. Swampert → Mud Shot / Hydro Cannon incl. the legacy move; sources cited in the test file); legacy moves included in ranking; empty pool → null recommendation + `species/SpeciesMovesApiTest.kt` (`GET /api/species/{id}/moves` per contract: fastMoves/chargedMoves with `legacy` markers, `recommended` pair or null; unknown species → 404; 401) first (fail) — then implement `gamedata/MovesetRanker.kt` (pure) wired into `SyncService.kt` (stores `recommended_*_move_id` on species at sync) + `species/SpeciesMovesController.kt` (+ repository queries) → green
- [ ] T029 [US5] MovesPanel, test-paired (depends on T028): write `web/src/components/detail/MovesPanel.test.tsx` first — move Selects offer only the species pool (from getSpeciesMoves), split fast/charged, legacy entries marked "not currently obtainable"; second charged slot optional; saving PATCHes move ids; recorded vs recommended rendered side-by-side with a match/mismatch indicator (matching = same fast + recommended charged among the recorded charged moves); no moves recorded → explicit unrecorded state, never a guess (US5 scenario 4); with moves recorded, `MatchupPanel` offensive coverage gains the recorded-move-type section, visually distinguished from STAB coverage (US5 scenario 5, FR-015 — uses T026's `moveTypes` parameter) (fail) — then implement `web/src/components/detail/MovesPanel.tsx` + the MatchupPanel wiring into `PokemonDetailPage.tsx` (MSW species-moves handlers extended) → green

**Checkpoint**: All five in-scope user stories independently functional; both suites green (quickstart US5 walkthrough passes)

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Docs, dev ergonomics, hygiene, and the full end-to-end validation gate

- [ ] T030 [P] Manual sync affordance + freshness polish, test-paired: write additions to `CollectionPage.test.tsx` first — a "refresh catalog" action, **rendered only for admin-role sessions** (`Me.roles`; sync is admin-only, spec assumption 2026-07-20), calls `triggerSync` and updates the freshness line; sync failure renders the problem+json detail in a Callout; `stalePokemonCount > 0` surfaces a notice linking to the stale-filtered list (fail) — then implement (small: PageHeader action + notice wiring) → green
- [ ] T031 [P] Dev seed data (dev-profile only, mirroring avec T032): dev-only repeatable migration seeding a handful of caught Pokémon across species/flags/IVs (incl. one hundo, one stale, one with recorded moves) for demos — `api/src/main/resources/db/seed/`; species/move rows referenced by the seed are inserted by the seed itself so it works before a live sync, using **real source ids and a real stat snapshot** (e.g. `BULBASAUR` with its true base stats) so a later live sync converges onto the same rows instead of leaving fictional species in the catalog (analyze U2 resolution); gate: `mvnw verify` stays green
- [ ] T032 [P] `README.md`: what pokedex is, stack summary, ports 3050/5050/5437, run instructions (compose + dev loops), hive prerequisite (pokedex client), game-data source + vendored-tables note (constitution Game Data Constraints), links to spec/plan
- [ ] T033 Code hygiene pass: `mvnw spotless:apply` + `yarn lint --fix` + prettier clean across both tiers; remove dead code; confirm `stats/` and `gamedata/MovesetRanker.kt` stay Spring-free and `web/src/lib/` React-free; both suites green after
- [ ] T034 Run the full quickstart.md validation: both suites green (`mvnw verify`, `yarn test --run` — Constitution II gate), compose stack up, live catalog sync, US1–US5 walkthroughs incl. the collision, impossible-input, staleness and isolation cross-cuts; spot-check SC-001 (registration < 30 s) and SC-003 (1,000-row filter < 1 s); record deviations as spec/plan amendments before handover

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately; T002–T004 parallel after T001 exists (repo layout)
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS all user stories**. T005, T006, T007, T010, T011 parallel; T008 → T009 sequential (security before auth BFF); T012 after T009 + T011. T010 needs T005's schema for its Testcontainers tests
- **US1 (Phase 3)**: After Foundational. T013/T014/T015 parallel → T016 (needs T013+T014) → T017 (needs T013–T015) → T018 (needs T013+T015+T010); web track T019 → T020 runs in parallel with the api track once T011/T012 exist (MSW fixtures decouple it)
- **US2 (Phase 4)**: After US1 (edits US1's list/page/dialog). T021/T022 parallel → T023
- **US3 (Phase 5)**: After US1; T024 parallel-safe, T025 creates the detail page (independent of US2)
- **US4 (Phase 6)**: T026 anytime after Setup (pure lib); T027 after T025 (panel lives on the detail page)
- **US5 (Phase 7)**: T028 after T010 (closes its ranker seam); T029 after T025 + T028
- **Polish (Phase 8)**: After all desired stories; T030–T032 parallel; T033 → T034 last

### User Story Dependencies

- **US1 (P1)**: None beyond Foundational — the MVP
- **US2 (P2)**: Extends US1's components — sequence after US1
- **US3 (P3)**: Needs US1's data; creates the detail page others reuse — independent of US2
- **US4 (P4)**: Pure display on the detail page — needs T025 (US3), independent of US2/US5
- **US5 (P5)**: Needs the detail page (US3) and the ranker (api-side, independent) — independent of US2/US4
- **US6 (badges)**: deferred — no tasks (research Scope note)

### Constitution reminders

- A **fresh feature branch per implementation increment — an increment = ONE task**, created **before any code** (e.g. `001-pokemon-collection-tracker-setup` for T001, `-web-scaffold` for T002); NEVER reuse the previous task's branch (constitution v1.0.1); PR-only into `main`
- **Every task is a green-to-green step**: tests written first *inside* the task, observed red, implemented to green — the suite passes at every task boundary, so any task can be a merge point for small green commits
- All work left **uncommitted** on the branch — the maintainer reviews and commits
- T004 touches `../docker-compose.yml` and T006 touches `../hive` — cross-repo/platform files, explicit maintainer approval

### Parallel Opportunities

- Phase 1: T002, T003, T004 after T001
- Phase 2: T005, T006, T007, T010, T011 simultaneously; T008→T009 while T010/T011 run
- US1: api track (T013/T014/T015 parallel → T016 → T017 → T018) in parallel with web track (T019 → T020)
- US4's T026 is a pure-lib island — schedulable whenever a slot is free
- US2 and (US3→US4/US5) are largely independent after US1 — different files
- Phase 8: T030, T031, T032 parallel

---

## Parallel Example: User Story 1

```bash
# Api track (each task test-paired internally, in dependency order):
Task: "T013 CPM/dust vendor + stats module — SC-002 sample red → green"
Task: "T014 SpeciesRepositoryTest → species search endpoint"
Task: "T015 CaughtPokemonRepositoryTest → domain + repository"
# then T016 → T017 → T018

# Web track, simultaneously (MSW fixtures stand in for the api):
Task: "T019 RegisterDialog.test → RegisterDialog + SpeciesSearch + LevelPicker"
Task: "T020 CollectionPage.test → CollectionPage v1"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup → Phase 2: Foundational (blocks everything; includes auth, catalog sync, hive registration)
2. Phase 3: US1 → **STOP and VALIDATE**: quickstart US1 walkthrough + calculator cross-check (SC-002) + isolation check
3. Demo: a real, hive-authenticated Pokémon calculator-plus-notebook

### Incremental Delivery

1. Setup + Foundational → login + synced catalog + empty shell works
2. + US1 → MVP: register and read the full derived picture (demo!)
3. + US2 → a browsable, maintainable collection
4. + US3 → hundo hunting + power-up projections (detail page born)
5. + US4 → matchup reading
6. + US5 → moveset advice
7. Polish → sync affordance, seed, README, full quickstart gate

Each increment: fresh branch, each task lands red→green, suite green at every
potential merge point, uncommitted handover, maintainer review.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to spec.md user story for traceability
- **Test-pairing rule**: a task is not done while anything it made red is still red; never hand over between the red and the green half of a task
- Leave work uncommitted on the feature branch per Constitution Principle III — the maintainer reviews and commits
- Stop at any checkpoint to validate the story independently
- Avec's tasks.md carries the platform's hard-won lessons in its [done] annotations (Boot 4 test-starter split, `.gitattributes` LF vs ktlint on Windows, `corepack yarn`, `@Primary` stub pattern, MSW dev-store, reach-ahead conventions) — mirror its shapes before inventing new ones; pulse's adds the `*Test` vs `*IT` naming and MSW patterns
- SC-002 (stat math), SC-006 (type chart), SC-007 (moveset) each live as pinned unit-test samples — T013, T026, T028 cite their external sources in the test files so re-verification is one click
