package no.rauboti.pokedex.caughtpokemon.domain

import java.time.LocalDate

/**
 * `PATCH /api/pokemon/{id}` body (contract `PokemonPatch`). Absent fields are left unchanged — which
 * also means a field can be set but not cleared back to null; clearing is out of scope for v1.
 */
data class PatchCaughtPokemon(
    val speciesId: String? = null,
    val ivAtk: Int? = null,
    val ivDef: Int? = null,
    val ivSta: Int? = null,
    val cp: Int? = null,
    val level: Double? = null,
    val shiny: Boolean? = null,
    val shadow: Boolean? = null,
    val lucky: Boolean? = null,
    val purified: Boolean? = null,
    val bestBuddy: Boolean? = null,
    val fastMoveId: String? = null,
    val chargedMove1Id: String? = null,
    val chargedMove2Id: String? = null,
    val caughtAt: LocalDate? = null,
)
