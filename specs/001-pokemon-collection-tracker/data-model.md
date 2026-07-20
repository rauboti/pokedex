# Data Model: Pokémon GO Collection Tracker

Three synced catalog tables (`species`, `move`, `species_move` — write-owned by the
sync module, D5), one player-owned table (`caught_pokemon`), and vendored reference
files that deliberately live outside the database (CPM, dust costs, type chart —
research D6). Derived values (HP, effective stats, IV%, projections) are computed by
the API on read and never stored, with one exception: the derived `level` is cached
on `caught_pokemon` and guarded by the staleness rescan (research D9).

Naming convention (platform precedent, pulse 2026-07-08): simple names, semantics
documented here rather than encoded in column names.

## Entity: Species (catalog)

One species+form from the synced game data. Table `species`
(migration `V1__create_catalog.sql`).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `text` | PK | Stable source identifier including form discriminator (e.g. `RATTATA_ALOLA`) — survives resyncs |
| `dex_nr` | `integer` | NOT NULL | National dex number (shared across forms) |
| `name` | `text` | NOT NULL | Display name |
| `form` | `text` | nullable | Human-readable form label (regional, mega, …); NULL for the base form |
| `base_atk` | `integer` | NOT NULL, `> 0` | |
| `base_def` | `integer` | NOT NULL, `> 0` | |
| `base_sta` | `integer` | NOT NULL, `> 0` | |
| `type_1` | `text` | NOT NULL | One of the 18 canonical types |
| `type_2` | `text` | nullable | Second type for dual-types |
| `recommended_fast_move_id` | `text` | nullable, FK → `move(id)` | Computed at sync (research D8); NULL when the pool is empty/unknown |
| `recommended_charged_move_id` | `text` | nullable, FK → `move(id)` | Computed at sync (research D8) |
| `synced_at` | `timestamptz` | NOT NULL | Last time this row was written by a sync (FR-011) |

**Index**: `(name)` — species search (`GET /api/species?q=`) is a name prefix/substring match.

**Sync semantics**: upsert by `id`; rows are never deleted (a form vanishing from the
source keeps existing collection rows valid). Base-stat changes trigger the staleness
rescan (research D9).

## Entity: Move (catalog)

One fast or charged move. Table `move` (migration `V1__create_catalog.sql`).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `text` | PK | Stable source identifier (e.g. `MUD_SHOT_FAST`) |
| `name` | `text` | NOT NULL | Display name |
| `type` | `text` | NOT NULL | Move type (STAB comparison, matchup display) |
| `is_fast` | `boolean` | NOT NULL | Fast vs charged |
| `power` | `double precision` | NOT NULL, `>= 0` | Gym/raid damage (moveset ranking input) |
| `energy` | `double precision` | NOT NULL | Energy gain (fast) / cost (charged) |
| `duration_ms` | `integer` | NOT NULL, `> 0` | Move duration (cycle-DPS denominator) |
| `synced_at` | `timestamptz` | NOT NULL | |

## Entity: Species move pool (catalog)

Which moves a species can know. Table `species_move`
(migration `V1__create_catalog.sql`).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `species_id` | `text` | FK → `species(id)`, part of PK | |
| `move_id` | `text` | FK → `move(id)`, part of PK | |
| `legacy` | `boolean` | NOT NULL, default `false` | Not currently obtainable by normal means (legacy/Elite TM) — US5 scenario 3 |

**Sync semantics**: pool rows for a species are replaced on sync (delete+insert per
species inside the sync transaction). A recorded move that leaves the pool stays on
the Pokémon (spec edge case "move pool changes") — `caught_pokemon` FKs point at
`move`, not `species_move`.

## Entity: Caught Pokémon (player-owned)

One registered Pokémon, owned by exactly one player. Table `caught_pokemon`
(migration `V2__create_caught_pokemon.sql`).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `user_id` | `text` | NOT NULL, indexed | Hive JWT `sub`; every query is scoped by it (FR-014); never exposed in responses |
| `species_id` | `text` | NOT NULL, FK → `species(id)` | Must exist in the synced catalog (unknown species unregistrable — spec edge case) |
| `nickname` | `text` | nullable | |
| `iv_atk` | `integer` | NOT NULL, `BETWEEN 0 AND 15` | |
| `iv_def` | `integer` | NOT NULL, `BETWEEN 0 AND 15` | |
| `iv_sta` | `integer` | NOT NULL, `BETWEEN 0 AND 15` | |
| `cp` | `integer` | NOT NULL, `>= 10` | Observed CP as entered (CP floor is 10) |
| `level` | `numeric(3,1)` | NOT NULL, `BETWEEN 1 AND 51`, half-steps app-enforced | Derived cache; written only by the API after solver confirmation (FR-002/FR-003); user-picked among candidates on CP collision |
| `stale` | `boolean` | NOT NULL, default `false` | Set by post-sync rescan when CP+IVs no longer yield `level` (FR-013/SC-005); cleared by re-deriving edit |
| `shiny` | `boolean` | NOT NULL, default `false` | |
| `shadow` | `boolean` | NOT NULL, default `false` | Display flag only — stats/CP use the normal formula (spec edge case) |
| `lucky` | `boolean` | NOT NULL, default `false` | |
| `purified` | `boolean` | NOT NULL, default `false` | Purification = player edit (new IVs/CP + flag), no automatic IV change (spec assumption) |
| `best_buddy` | `boolean` | NOT NULL, default `false` | Adds the +1-level projection in DTOs; never alters stored `level` (spec edge case) |
| `fast_move_id` | `text` | nullable, FK → `move(id)` | App-validated against the species pool **at write time** (US5 scenario 1); NULL = unrecorded |
| `charged_move_1_id` | `text` | nullable, FK → `move(id)` | Same validation |
| `charged_move_2_id` | `text` | nullable, FK → `move(id)` | GO allows a second unlocked charged slot; NULL = not unlocked/unrecorded |
| `caught_at` | `date` | nullable | Catch date (FR-004) |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()`, touched on update | |

**Index**: `(user_id)` — all reads are user-scoped; ordering happens client-side (D10).

**Deletion** (FR-010): hard delete, no dependents.

**Write-path invariants** (service layer, tested):
1. Solver must confirm `(species, IVs, CP) → level`; ambiguous → client must send one
   of the candidate levels; no match → 422 (FR-003, SC-004).
2. Recorded moves must be fast/charged-correct (`is_fast`) and in the species pool at
   write time.
3. Any edit touching `species_id`, IVs, or `cp` re-derives and clears `stale`.

## Reference data (vendored, not tables — research D6)

| Data | Location | Consumer |
|------|----------|----------|
| CPM per level (1.0–51.0 half-steps) | `api/src/main/resources/reference/cpm.json` | Solver, projections (D7) |
| Power-up dust cost per level band | `api/src/main/resources/reference/dust.json` | CP-collision disambiguation hints (US1 scenario 4) |
| Type-effectiveness chart (18×18, GO multipliers) | `web/src/lib/typeChart.ts` | Matchup view (US4), computed client-side from species types |

## Relationships & derived-value flow

```text
species 1 ──── * species_move * ──── 1 move
   │                                    ▲
   │ (recommended_*_move_id)────────────┘
   │
   1
   │
   * caught_pokemon (user-scoped) ──(fast/charged move ids)──► move
```

Read path: `caught_pokemon` row + `species` base stats + vendored CPM
→ API computes HP, effective stats, IV%, projections (L40/L50, Best Buddy +1)
→ single DTO; the web app never does stat math (D7). Matchups are derived in the
browser from `species.type_1/type_2` + the vendored type chart (D6).
