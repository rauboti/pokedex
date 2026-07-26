package no.rauboti.pokedex.move.dto

/** A move as the API returns it (contract `Move`). `legacy` is populated on pool listings; on
 *  a Pokémon's recorded moves it is left null. */
data class MoveDto(
    val id: String,
    val name: String,
    val type: String,
    val fast: Boolean,
    val legacy: Boolean? = null,
)
