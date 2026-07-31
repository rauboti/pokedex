-- Synced game-data catalog: written only by the sync module, upserted by stable source `id`,
-- rows never deleted (a form vanishing from the source must not invalidate collection rows).
-- `move` comes first because `species` carries the recommended-moveset FKs.

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

-- `id` embeds the form discriminator (e.g. RATTATA_ALOLA) so it survives resyncs.
-- `registrable` is false for mega/temporary battle forms. The recommended-move FKs are
-- computed at sync time and NULL when the pool is empty or unknown.
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
    image_url                   text,
    shiny_image_url             text,
    rarity                      text,
    synced_at                   timestamptz not null,

    constraint species_base_atk_check check (base_atk > 0),
    constraint species_base_def_check check (base_def > 0),
    constraint species_base_sta_check check (base_sta > 0)
);

-- Which moves a species can know. A species' rows are replaced wholesale on sync.
-- `legacy` marks moves no longer obtainable by normal means (legacy / Elite TM).
create table species_move (
    species_id text    not null references species (id),
    move_id    text    not null references move (id),
    legacy     boolean not null default false,

    constraint species_move_pk primary key (species_id, move_id)
);

create index idx_species_name on species (name);
