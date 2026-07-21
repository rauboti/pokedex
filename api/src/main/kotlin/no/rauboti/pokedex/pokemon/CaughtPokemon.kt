package no.rauboti.pokedex.pokemon

import java.time.Instant
import java.time.LocalDate
import java.util.UUID

/**
 * A registered Pokémon as stored (data-model `caught_pokemon`). `level` is the derived cache written
 * only after solver confirmation (FR-002/FR-003); `stale` is set by the post-sync rescan (FR-013).
 * Move-slot ids are nullable FKs to `move` (null = unrecorded). Derived values (HP, effective stats,
 * IV%, projections) are computed on read and never stored (research D7) — this row is the raw record.
 */
data class CaughtPokemon(
    val id: UUID,
    val userId: String,
    val speciesId: String,
    val ivAtk: Int,
    val ivDef: Int,
    val ivSta: Int,
    val cp: Int,
    val level: Double,
    val stale: Boolean,
    val shiny: Boolean,
    val shadow: Boolean,
    val lucky: Boolean,
    val purified: Boolean,
    val bestBuddy: Boolean,
    val fastMoveId: String?,
    val charged1MoveId: String?,
    val charged2MoveId: String?,
    val caughtAt: LocalDate?,
    val createdAt: Instant,
    val updatedAt: Instant,
)

/**
 * The fields a caller supplies to register a Pokémon; the id and created/updated timestamps are
 * assigned by the database (data-model defaults). Flags default off and moves unrecorded.
 */
data class NewCaughtPokemon(
    val userId: String,
    val speciesId: String,
    val ivAtk: Int,
    val ivDef: Int,
    val ivSta: Int,
    val cp: Int,
    val level: Double,
    val stale: Boolean = false,
    val shiny: Boolean = false,
    val shadow: Boolean = false,
    val lucky: Boolean = false,
    val purified: Boolean = false,
    val bestBuddy: Boolean = false,
    val fastMoveId: String? = null,
    val charged1MoveId: String? = null,
    val charged2MoveId: String? = null,
    val caughtAt: LocalDate? = null,
)
