package no.rauboti.pokedex.move.domain

/** The winning pairing (move ids), stored on the species row and returned with its move pool. */
data class RecommendedMoveset(
    val fastMoveId: String,
    val chargedMoveId: String,
)