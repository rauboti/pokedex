package no.rauboti.pokedex.move.domain

/**
 * The recommended-moveset move ids stored on a species row. Either id may be null — a species
 * with no computed recommendation (e.g. an empty or charged-less pool) has both null. Distinct from
 * the API's `recommended` object, which exists only when *both* are present.
 */
data class RecommendedMoveIds(
    val fastMoveId: String?,
    val chargedMoveId: String?,
)
