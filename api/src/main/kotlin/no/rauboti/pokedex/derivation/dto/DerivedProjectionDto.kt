package no.rauboti.pokedex.derivation.dto

/** One projected level row (contract `Derived.projections[]`); `label` is L40/L50/BEST_BUDDY. */
data class DerivedProjectionDto(
    val label: String,
    val level: Double,
    val cp: Int,
    val hp: Int,
    val attack: Double,
    val defense: Double,
    val stamina: Double,
)
