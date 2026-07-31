package no.rauboti.pokedex.caughtpokemon.domain

import java.time.Instant
import java.time.LocalDate
import java.util.UUID

/**
 * A registered Pokémon exactly as stored — the raw record. Everything derived (HP, effective stats,
 * IV%, projections) is computed on read and never persisted here.
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
