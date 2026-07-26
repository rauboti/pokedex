package no.rauboti.pokedex.caughtpokemon.domain

import java.time.LocalDate

/**
 * `POST /api/pokemon` request body (contract `PokemonInput`). `level` is required only when the
 * derivation is ambiguous and must then be one of the candidate levels (write invariant 1); flags
 * default off and moves are unrecorded unless supplied.
 */
data class CreateCaughtPokemon(
    val speciesId: String,
    val ivAtk: Int,
    val ivDef: Int,
    val ivSta: Int,
    val cp: Int,
    val level: Double? = null,
    val shiny: Boolean = false,
    val shadow: Boolean = false,
    val lucky: Boolean = false,
    val purified: Boolean = false,
    val bestBuddy: Boolean = false,
    val fastMoveId: String? = null,
    val chargedMove1Id: String? = null,
    val chargedMove2Id: String? = null,
    val caughtAt: LocalDate? = null,
)


