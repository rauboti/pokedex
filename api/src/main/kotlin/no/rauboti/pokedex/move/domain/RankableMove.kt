package no.rauboti.pokedex.move.domain

/**
 * A single move as the ranker sees it. [energy] follows the feed convention: a fast move's energy is
 * the (positive) energy it generates, a charged move's is the (negative) energy it costs.
 */
data class RankableMove(
    val id: String,
    val type: String,
    val fast: Boolean,
    val power: Double,
    val energy: Double,
    val durationMs: Int,
)
