package no.rauboti.pokedex.catalog.sync.domain

/** One fast/charged move row (data-model `move`). */
data class NormalizedMove(
    val id: String,
    val name: String,
    val type: String,
    val isFast: Boolean,
    val power: Double,
    val energy: Double,
    val durationMs: Int,
)
