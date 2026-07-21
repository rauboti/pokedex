-- TABLES

-- Caught Pokémon: one registered Pokémon owned by exactly one player (data-model.md).
-- `user_id` is the hive JWT `sub` claim — every read is user-scoped (FR-014) and it
-- is never exposed in responses. `species_id` must exist in the synced catalog
-- (unknown species unregistrable — spec edge case); non-registrable (mega) species
-- are rejected in the service layer, not here (write invariant 0).
--
-- `level` is a derived cache: written only by the API after solver confirmation
-- (FR-002/FR-003), user-picked among candidates on a CP collision, stored as
-- half-steps (app-enforced). `stale` is set by the post-sync rescan when CP+IVs no
-- longer yield `level` (FR-013/SC-005) and cleared by a re-deriving edit. `shadow`
-- and `best_buddy` are display/projection flags only and never alter stored stats
-- (spec edge cases). The move-slot FKs point at `move` (not `species_move`) so a
-- recorded move survives a pool change; NULL = unrecorded. All derived values (HP,
-- effective stats, IV%, projections) are computed on read, never stored.
create table caught_pokemon (
    id                uuid          primary key default gen_random_uuid(),
    user_id           text          not null,
    species_id        text          not null references species (id),
    iv_atk            integer       not null,
    iv_def            integer       not null,
    iv_sta            integer       not null,
    cp                integer       not null,
    level             numeric(3, 1) not null,
    stale             boolean       not null default false,
    shiny             boolean       not null default false,
    shadow            boolean       not null default false,
    lucky             boolean       not null default false,
    purified          boolean       not null default false,
    best_buddy        boolean       not null default false,
    fast_move_id      text          references move (id),
    charged_move_1_id text          references move (id),
    charged_move_2_id text          references move (id),
    caught_at         date,
    created_at        timestamptz   not null default now(),
    updated_at        timestamptz   not null default now(),

    constraint caught_pokemon_iv_atk_check check (iv_atk between 0 and 15),
    constraint caught_pokemon_iv_def_check check (iv_def between 0 and 15),
    constraint caught_pokemon_iv_sta_check check (iv_sta between 0 and 15),
    constraint caught_pokemon_cp_check check (cp >= 10),
    constraint caught_pokemon_level_check check (level between 1 and 51)
);

-- INDEXES

-- All reads are user-scoped (FR-014); ordering happens client-side (research D10).
create index idx_caught_pokemon_user on caught_pokemon (user_id);
