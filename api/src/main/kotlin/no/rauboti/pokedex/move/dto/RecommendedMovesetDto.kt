package no.rauboti.pokedex.move.dto

/** The recommended pairing as move ids (contract `SpeciesMoves.recommended`). */
data class RecommendedMovesetDto(
    val fastMoveId: String,
    val chargedMoveId: String,
)
