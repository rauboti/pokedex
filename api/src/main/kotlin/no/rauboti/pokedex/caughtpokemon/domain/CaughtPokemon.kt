package no.rauboti.pokedex.caughtpokemon.domain

import java.time.Instant
import java.time.LocalDate
import java.util.UUID

/**
 * A registered Pokémon as stored (data-model `caught_pokemon`). `level` is the derived cache written only
 * after solver confirmation; `stale` is set by the post-sync rescan. Move-slot ids are nullable FKs to
 * `move` (null = unrecorded). Derived values (HP, effective stats, IV%, projections) are computed on read
 * and never stored — this row is the raw record.
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
