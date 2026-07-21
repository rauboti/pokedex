# Feature Specification: Pokémon GO Collection Tracker

**Feature Branch**: `001-pokemon-collection-tracker`

**Created**: 2026-07-20

**Status**: Draft

**Input**: User description: "A tracking application for Pokémon GO: register caught Pokémon (species, IVs, observed CP) and view their derived level, HP, effective stats, types, and flags (shiny/shadow/lucky/purified). Full details in POKEDEX_PROJECT_BRIEF.md — includes collection view with filter/sort, perfect-IV (hundo) tracking with level projections, and stretch goals for PvP stat product/league ranks and badge tracking."

## Clarifications

### Session 2026-07-20

- Q: Should mega/temporary battle forms be registrable in US1's species search? → A: Sync them into the catalog but exclude them from registration search (a `registrable` flag on species; search filters on it).
- Q: Is collection data export (JSON/CSV) in scope for v1? → A: Out of scope for v1 — recorded as an explicit future item.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Register a caught Pokémon (Priority: P1)

A player catches a Pokémon in Pokémon GO and wants to record it. They open the app,
search for the species (including regional forms, megas, and other variants), enter the
three IV values (attack, defense, stamina, each 0–15) as appraised in-game, and the
observed CP. The app derives the Pokémon's level from these inputs and immediately shows
level, HP, effective attack/defense/stamina, IV percentage, and the species' type(s).
The player can optionally add a catch date and flags: shiny, shadow, lucky, purified,
and Best Buddy.

**Why this priority**: This is the core value of the product — turning the three numbers
the game shows you into the full derived picture. Nothing else in the app works without
registered Pokémon, and even alone this is a useful calculator-plus-notebook.

**Independent Test**: Can be fully tested by registering a Pokémon with known
species/IVs/CP and verifying the derived level, HP, and stats match trusted community
calculators for the same inputs.

**Acceptance Scenarios**:

1. **Given** the species catalog is loaded, **When** the player types a partial species
   name, **Then** matching species (including forms) are suggested and one can be
   selected.
2. **Given** a selected species with IVs 15/15/15 and a valid observed CP, **When** the
   player saves, **Then** the app stores the Pokémon and displays its derived level, HP,
   effective stats, IV% (100%), and types.
3. **Given** IVs and a CP that correspond to exactly one level, **When** the player
   saves, **Then** that level is assigned automatically without further input.
4. **Given** IVs and a CP that match more than one level (a CP collision — in practice the
   CP-floor plateau at the lowest levels, where several adjacent half-levels share the
   minimum CP), **When** the player saves, **Then** the app presents all matching levels,
   each shown with its power-up dust cost, and the player picks one. (Amended 2026-07-21,
   T016: because such collisions occur only *within* the CP-floor plateau — a single dust
   tier — the candidates' dust costs are equal; the dust figure is an informational hint
   shown per candidate, not the differentiator, and the player distinguishes by level.)
5. **Given** IVs and a CP that match no level for that species, **When** the player
   attempts to save, **Then** the app rejects the combination with a message explaining
   that species, IVs, and CP are inconsistent.
6. **Given** a registered Pokémon, **When** the player marks it as shadow, **Then** the
   stored CP/HP remain those of the normal formula and the shadow status is shown as a
   flag.

---

### User Story 2 - Browse and filter the collection (Priority: P2)

The player opens their collection and sees all registered Pokémon with their key values
(species, level, CP, IV%, types, flags). They can filter by species, type,
and flags (shiny/shadow/lucky/purified), and sort by IV%, CP, level, catch date, or
species name — for example "show my shiny Pokémon sorted by IV%" or "all Dragon types
above 90% IV".

**Why this priority**: Once more than a handful of Pokémon are registered, retrieval and
comparison is what makes this a tracker rather than a one-shot calculator.

**Independent Test**: Register several Pokémon with distinct species, IVs, and flags,
then verify each filter and sort combination returns exactly the expected subset in the
expected order.

**Acceptance Scenarios**:

1. **Given** a collection with multiple Pokémon, **When** the player opens the
   collection view, **Then** all registered Pokémon are listed with species name (and
   form), level, CP, IV%, types, and flags visible.
2. **Given** a filter on a flag (e.g. shiny), **When** applied, **Then** only Pokémon
   with that flag are shown and the active filter is visible.
3. **Given** a sort on IV% descending, **When** applied, **Then** Pokémon are ordered
   from highest to lowest IV%.
4. **Given** an active filter with no matches, **When** displayed, **Then** an empty
   state explains that no Pokémon match the current filter.

---

### User Story 3 - Perfect-IV tracking and level projections (Priority: P3)

The player wants to see which of their Pokémon are perfect (15/15/15 — "hundos") at a
glance, and for any Pokémon, what its CP, HP, and stats would be if powered up to level
40 or level 50.

**Why this priority**: Hundo hunting and "is it worth powering up?" are the questions
collectors ask most after registering; projections reuse the same math as registration.

**Independent Test**: Register a mix of perfect and imperfect Pokémon; verify hundos are
visibly highlighted and that a projection for a known Pokémon at level 40/50 matches
trusted community calculators.

**Acceptance Scenarios**:

1. **Given** a collection containing a 15/15/15 Pokémon, **When** viewing the
   collection, **Then** the perfect Pokémon is visually highlighted as a hundo.
2. **Given** any registered Pokémon, **When** the player opens its projection view,
   **Then** CP, HP, and effective stats at level 40 and level 50 are shown.
3. **Given** a Pokémon flagged as Best Buddy, **When** viewing its details, **Then**
   values are shown for its boosted level (+1) as well as its base level.

---

### User Story 4 - Type matchups and weaknesses (Priority: P4)

The player views a registered Pokémon and wants to understand its battle matchups: which
attack types it is weak or resistant to defensively (derived from its type or type
combination), and which types its own attacks hit super-effectively. Dual-type Pokémon
show stacked effectiveness (e.g. double weakness) where applicable.

**Why this priority**: Turns the tracker into a battle-prep tool — "which of my Pokémon
should I bring against this raid boss?" — using only data already attached to each
registered Pokémon. Strictly additive on top of US1–US3.

**Independent Test**: For a Pokémon of a known single type and one of a known dual type,
verify the displayed weaknesses, resistances, and offensive strengths match the
canonical type-effectiveness chart.

**Acceptance Scenarios**:

1. **Given** a registered single-type Pokémon, **When** the player opens its matchup
   view, **Then** the app lists the attack types it is weak to, resistant to, and
   neutral against, per the canonical type chart.
2. **Given** a registered dual-type Pokémon, **When** viewing its matchups, **Then**
   effectiveness from both types is combined (e.g. a double weakness is distinguished
   from a single weakness).
3. **Given** a registered Pokémon, **When** viewing its matchups, **Then** the app
   lists the types its own attack type(s) are super-effective against.

---

### User Story 5 - Move tracking and optimal moveset (Priority: P5)

The player records which fast and charged move(s) their Pokémon actually knows, chosen
from the species' available move pool. The app shows how that moveset compares to the
species' best-performing moveset, so the player knows whether it is worth using a TM or
Elite TM — for example "your Swampert has Water Gun / Sludge Wave, but its optimal
moveset is Mud Shot / Hydro Cannon".

**Why this priority**: Complements matchups (US4) with the other half of battle
readiness. Depends on the species catalog carrying move data, which no earlier story
needs, so it lands after them.

**Independent Test**: Register a Pokémon, assign it moves from its species move pool,
and verify the app flags whether the moveset is optimal and names the recommended
moveset for a sample of species, consistent with trusted community resources.

**Acceptance Scenarios**:

1. **Given** a registered Pokémon, **When** the player edits its moves, **Then** only
   moves from that species' move pool are offered, and the selection is saved.
2. **Given** a Pokémon with recorded moves, **When** viewing its details, **Then** the
   app shows its current moveset alongside the species' recommended moveset and
   indicates whether they match.
3. **Given** a species whose move pool includes legacy/Elite-TM-only moves, **When**
   browsing its move pool, **Then** such moves are marked as not currently obtainable
   by normal means.
4. **Given** a Pokémon with no moves recorded, **When** viewing its details, **Then**
   the moveset area shows an unrecorded state rather than a guess.
5. **Given** a Pokémon with recorded moves, **When** viewing its type matchups (US4),
   **Then** offensive coverage additionally reflects the types of its recorded moves,
   visually distinguished from the species-type (STAB) coverage.

---

### User Story 6 - Badge and achievement tracking (Priority: P6, stretch)

The player manually tracks their in-game badge/achievement progress (e.g. distance
walked, Pokémon caught tiers) against the known badge definitions and tier thresholds,
and sees how far they are from the next tier.

**Why this priority**: Nice-to-have companion feature, fully independent of the
collection math. Declared a stretch goal in the project brief.

**Independent Test**: Enter a progress value for a badge and verify the displayed tier
and distance-to-next-tier match the badge's published thresholds.

**Acceptance Scenarios**:

1. **Given** the badge catalog is available, **When** the player enters their current
   progress for a badge, **Then** the app shows the achieved tier and the remaining
   amount to the next tier.

---

### Edge Cases

- **CP collision**: adjacent half-levels can produce the same CP for low-stat species —
  the app MUST surface all matching levels and let the player disambiguate (US1,
  scenario 4).
- **No matching level**: mistyped IVs or CP produce an impossible combination — the app
  MUST reject with a helpful message rather than storing bad data.
- **Minimum clamps**: CP has a floor of 10 and HP a floor of 10 at low levels; derived
  and projected values MUST respect these clamps.
- **Shadow Pokémon**: displayed CP/HP use the normal formula; shadow is a flag, not a
  stat change, in stored data. Purifying a shadow Pokémon changes its IVs in-game — the
  player edits the record (IVs, CP, purified flag) and derived values update.
- **Best Buddy boost**: a Best Buddy plays at +1 level while boosted; the flag MUST NOT
  alter the stored base level derived from the observed CP taken when unboosted, and if
  the player registers the CP observed while boosted this MUST be resolvable.
- **Species rebalance**: base stats change when the game rebalances — after a species
  data refresh, previously derived levels may no longer match the stored CP; the app
  MUST detect and flag such Pokémon for re-entry rather than silently showing stale or
  inconsistent values.
- **New species/forms**: species released after the last data sync are missing from the
  catalog — the player sees when the catalog was last refreshed, and registration of an
  unknown species is not possible until the catalog is updated.
- **Mega/temporary forms**: present in the synced catalog (own base stats) but not
  catchable — excluded from registration search via the species' registrable flag;
  registering one is impossible by construction (clarification 2026-07-20).
- **Move pool changes**: a data refresh can rebalance moves or remove a recorded move
  from a species' pool — recorded moves are kept (the Pokémon still knows them in-game)
  but the recommended moveset reflects the refreshed data.
- **Editing**: correcting IVs or CP on an existing record MUST re-derive level and all
  dependent values.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST let players register a caught Pokémon by selecting a species
  (searchable by name, including catchable forms and variants) and entering IV values
  for attack, defense, and stamina (each an integer 0–15) and the observed CP.
  Mega/temporary battle forms are synced into the catalog but MUST NOT be offered in
  registration search (clarification 2026-07-20).
- **FR-002**: System MUST derive the Pokémon's level (1–51 in half-level steps) from
  species base stats, IVs, and observed CP, and from it compute HP, effective
  attack/defense/stamina, and IV percentage.
- **FR-003**: System MUST handle ambiguous CP→level results by presenting all matching
  levels with a disambiguation hint, and MUST reject species/IV/CP combinations that
  match no level.
- **FR-004**: System MUST support optional attributes per Pokémon: catch date and the
  flags shiny, shadow, lucky, purified, and Best Buddy. Nicknames are not supported
  for the time being (maintainer decision 2026-07-20).
- **FR-005**: System MUST persist registered Pokémon so the collection survives
  restarts and is available on the player's next visit.
- **FR-006**: System MUST provide a collection view showing species name (and form),
  level, CP, IV%, types, and flags for every registered Pokémon.
- **FR-007**: Users MUST be able to filter the collection by species, type, and each
  flag, and sort by IV%, CP, level, catch date, and species name.
- **FR-008**: System MUST visually highlight perfect-IV (15/15/15) Pokémon in the
  collection.
- **FR-009**: System MUST show projected CP, HP, and effective stats for any registered
  Pokémon at level 40 and level 50, and boosted values for Best Buddies (+1 level).
- **FR-010**: Users MUST be able to edit and delete registered Pokémon; edits to
  species, IVs, or CP MUST re-derive all dependent values.
- **FR-011**: System MUST source species data (base stats, types, forms) and move data
  (moves, per-species move pools) from a community-maintained game-data source and keep
  it refreshable without code changes; each synced record MUST carry the time it was
  last synced. Species base stats and move data MUST NOT be hardcoded.
- **FR-012**: System MUST NOT integrate with unofficial Pokémon GO player-data APIs;
  all personal collection data is entered manually.
- **FR-013**: System MUST detect registered Pokémon whose stored CP no longer matches
  any level after a species data refresh and flag them for player attention.
- **FR-014**: System MUST restrict each player's collection to their own signed-in
  platform account.
- **FR-015**: System MUST show, per registered Pokémon, its defensive type
  effectiveness (weaknesses, resistances, immunities-in-effect) derived from its type
  or combined dual-type, and the types its own attack type(s) hit super-effectively,
  per the canonical type-effectiveness chart. When moves are recorded (FR-016),
  offensive coverage MUST additionally reflect the recorded moves' types,
  distinguished from the species-type (STAB) coverage.
- **FR-016**: System MUST let players record their Pokémon's fast and charged moves,
  restricted to the species' move pool from the synced game data; moves not currently
  obtainable by normal means (legacy/Elite TM) MUST be marked as such.
- **FR-017**: System MUST show the species' recommended (best-performing) moveset
  alongside the Pokémon's recorded moves and indicate whether they match.
- **FR-018** *(stretch)*: System SHOULD let players manually track badge/achievement
  progress against published badge tiers.

*Deferred*: PvP league relevance (Great/Ultra League stat product and IV-spread rank)
is explicitly deferred — kept out of scope for this feature and revisitable as a future
spec.

### Key Entities

- **Species**: a catalog entry from the synced game data — dex number, name, form
  discriminator, base attack/defense/stamina, type(s), a registrable flag (false for
  mega/temporary battle forms), and last-synced timestamp. Read mostly; refreshed by
  sync, never hand-edited.
- **Caught Pokémon**: a player-owned record — reference to a Species, IVs (0–15 ×3),
  observed CP, derived level (cached), catch date, flags (shiny, shadow, lucky,
  purified, Best Buddy), owner, created timestamp.
- **CP multiplier table**: the fixed per-level multiplier lookup (levels 1–51 in
  half-steps) that all derivations depend on; stable reference data.
- **Type effectiveness chart**: the canonical attack-type vs defend-type multiplier
  matrix (18 types); stable reference data.
- **Move**: a fast or charged move from the synced game data — name, type, and the
  performance attributes needed to rank movesets. **Species move pool**: which moves a
  species can know, including legacy/Elite-TM availability markers; refreshed by sync.
- **Recorded moveset**: the fast and charged move(s) a player has recorded on a Caught
  Pokémon; optional until entered.
- **Badge definition** *(stretch)*: a badge with its tier thresholds, from the synced
  game data. **Badge progress** *(stretch)*: the player's manually entered progress per
  badge.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Registering a Pokémon (species search → IVs → CP → save) takes under 30
  seconds for a practiced user.
- **SC-002**: Derived level, HP, and stats agree with at least two trusted community
  calculators for a verification sample of at least 10 Pokémon spanning low/high CP,
  perfect and imperfect IVs, and at least one CP-collision case — with zero
  discrepancies.
- **SC-003**: Filtering or sorting a collection of 1,000 Pokémon updates the view in
  under 1 second.
- **SC-004**: 100% of impossible species/IV/CP combinations entered during testing are
  rejected with an explanatory message (none are silently stored).
- **SC-005**: After a species data refresh introduces changed base stats, every
  affected Pokémon is flagged; no stale derived values are displayed unflagged.
- **SC-006**: Displayed weaknesses and resistances match the canonical
  type-effectiveness chart for a verification sample covering every attack type and at
  least three dual-type combinations (including one double weakness) — with zero
  discrepancies.
- **SC-007**: For a sample of at least 5 well-known species, the recommended moveset
  matches the top moveset listed by a trusted community resource.

## Assumptions

- Personal, single-player use: each player sees only their own collection; sharing and
  social features are out of scope. Sign-in reuses the platform's existing identity
  service (per constitution) rather than app-specific accounts.
- Manual entry only for v1; screenshot OCR import is a possible later feature and is
  out of scope. This follows from the absence of any official player-data API and the
  constitution's ToS constraint.
- PvP league relevance (stat product, IV-spread rank under league CP caps) is deferred
  per maintainer decision (2026-07-20) and excluded from this feature's scope.
- "Optimal moveset" uses a single, simple ranking heuristic over the synced move data
  (sustained damage output); battle-simulation-grade rankings and per-matchup movesets
  are out of scope. The exact heuristic is a planning decision, validated via SC-007.
- The remaining stretch story (US6 badges) is in scope for specification but may be
  deferred at planning; earlier stories deliver full value without it.
- Offensive effectiveness in US4 is based on the Pokémon's own type(s) (STAB
  perspective); US5 explicitly extends it with recorded-move-type coverage (US5
  scenario 5, FR-015).
- Nicknames are out of scope for now — Pokémon are identified by species name (and
  form); "sort by name" means species name. Revisitable in a later spec.
- Catalog sync is admin-only: the roles are `user` and `admin`, and only `admin` may
  trigger a game-data sync (maintainer decision 2026-07-20).
- Species catalog freshness is best-effort: a scheduled or on-demand refresh is
  sufficient; real-time game parity is not required.
- Data is retained indefinitely until the player deletes it; collections are expected
  to reach low thousands of Pokémon, not millions.
- Collection data export (JSON/CSV) is out of scope for v1 (clarification
  2026-07-20) — a candidate for a later spec, alongside PvP relevance and OCR import.
- Purification is handled as an edit to the existing record (new IVs/CP, purified flag)
  rather than automatic IV adjustment.
