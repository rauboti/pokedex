package no.rauboti.pokedex.move.dto

/**
 * A species' move pool plus its sync-computed optimal moveset (contract `SpeciesMoves`).
 * [recommended] is null when the pool yields no pairing.
 */
data class SpeciesMovesDto(
    val speciesId: String,
    val fastMoves: List<MoveDto>,
    val chargedMoves: List<MoveDto>,
    val recommended: RecommendedMovesetDto?,
)
