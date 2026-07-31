package no.rauboti.pokedex.move.domain

/**
 * The recommended move ids on a species row. Either may be null — distinct from the API's
 * `recommended` object, which exists only when *both* are present.
 */
data class RecommendedMoveIds(
    val fastMoveId: String?,
    val chargedMoveId: String?,
)
