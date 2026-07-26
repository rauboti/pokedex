package no.rauboti.pokedex.derivation.dto

/** The server-computed derived block (contract `Derived`). */
data class DerivedDto(
    val level: Double,
    val hp: Int,
    val attack: Double,
    val defense: Double,
    val stamina: Double,
    val ivPercent: Double,
    val perfect: Boolean,
    val projections: List<DerivedProjectionDto>,
)
