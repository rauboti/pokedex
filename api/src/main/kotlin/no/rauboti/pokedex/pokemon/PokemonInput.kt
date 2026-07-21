package no.rauboti.pokedex.pokemon

import java.time.LocalDate

/**
 * `POST /api/pokemon` request body (contract `PokemonInput`). `level` is required only when the
 * derivation is ambiguous and must then be one of the candidate levels (write invariant 1); flags
 * default off and moves are unrecorded unless supplied.
 */
data class PokemonInput(
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

/**
 * `PATCH /api/pokemon/{id}` body (contract `PokemonPatch`). Partial semantics: a null (or absent)
 * field leaves the current value unchanged. Changing `speciesId`/IVs/`cp` re-derives the level and
 * clears `stale` (write invariant 3); on such a re-derive, `level` disambiguates a CP collision.
 * (A field can be set but, with these semantics, not cleared back to null — clearing a recorded
 * move / catch date is out of scope for v1.)
 */
data class PokemonPatch(
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
