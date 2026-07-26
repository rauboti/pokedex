package no.rauboti.pokedex.caughtpokemon.domain

import java.time.LocalDate

/**
 * `PATCH /api/pokemon/{id}` body (contract `PokemonPatch`). Partial semantics: a null (or absent)
 * field leaves the current value unchanged. Changing `speciesId`/IVs/`cp` re-derives the level and
 * clears `stale` (write invariant 3); on such a re-derive, `level` disambiguates a CP collision.
 * (A field can be set but, with these semantics, not cleared back to null — clearing a recorded
 * move / catch date is out of scope for v1.)
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
