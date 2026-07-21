-- TABLES
--
-- Synced game-data catalog (data-model.md): three tables written only by the sync
-- module (gamedata/, research D5). Upsert by stable source `id`; rows are never
-- deleted (a form vanishing from the source keeps existing collection rows valid).
-- `synced_at` records the last sync that wrote each row (FR-011). `move` is created
-- before `species` because species carries the recommended-moveset FKs (research D8).

-- Move: one fast or charged move (data-model.md). Ranking inputs (power/energy/
-- duration_ms) drive the sync-time moveset ranker (research D8); `type` feeds STAB
-- and matchup display.
create table move (
    id          text             primary key,
    name        text             not null,
    type        text             not null,
    is_fast     boolean          not null,
    power       double precision not null,
    energy      double precision not null,
    duration_ms integer          not null,
    synced_at   timestamptz      not null,

    constraint move_power_check check (power >= 0),
    constraint move_duration_ms_check check (duration_ms > 0)
);

-- Species: one species+form from the synced game data (data-model.md). `id` embeds
-- the form discriminator (e.g. RATTATA_ALOLA) so it survives resyncs. `registrable`
-- is false for mega/temporary battle forms — the sync normalizer sets it and
-- registration search filters on it (clarification 2026-07-20). The recommended-move
-- FKs are computed at sync (research D8) and NULL when the pool is empty/unknown.
-- Base-stat changes across a resync trigger the staleness rescan (research D9).
create table species (
    id                          text        primary key,
    dex_nr                      integer     not null,
    name                        text        not null,
    form                        text,
    base_atk                    integer     not null,
    base_def                    integer     not null,
    base_sta                    integer     not null,
    type_1                      text        not null,
    type_2                      text,
    registrable                 boolean     not null default true,
    recommended_fast_move_id    text        references move (id),
    recommended_charged_move_id text        references move (id),
    synced_at                   timestamptz not null,

    constraint species_base_atk_check check (base_atk > 0),
    constraint species_base_def_check check (base_def > 0),
    constraint species_base_sta_check check (base_sta > 0)
);

-- Species move pool: which moves a species can know (data-model.md). Pool rows for a
-- species are replaced on sync (delete+insert per species inside the sync
-- transaction). `legacy` marks moves not currently obtainable by normal means
-- (legacy/Elite TM) — US5 scenario 3. A recorded move that later leaves the pool
-- stays on the Pokémon: caught_pokemon FKs point at `move`, not `species_move`.
create table species_move (
    species_id text    not null references species (id),
    move_id    text    not null references move (id),
    legacy     boolean not null default false,

    constraint species_move_pk primary key (species_id, move_id)
);

-- INDEXES

-- Species search (GET /api/species?q=) is a case-insensitive name substring match.
create index idx_species_name on species (name);
