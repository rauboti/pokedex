package no.rauboti.pokedex.caughtpokemon.domain

import java.time.LocalDate

/**
 * The fields a caller supplies to register a Pokémon; the id and created/updated timestamps are
 * assigned by the database (data-model defaults). Flags default off and moves unrecorded.
 */
data class CaughtBasePokemon(
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
