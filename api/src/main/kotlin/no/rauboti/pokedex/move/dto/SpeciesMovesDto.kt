package no.rauboti.pokedex.move.dto

/**
 * A species' move pool plus its sync-computed optimal moveset (contract `SpeciesMoves`.
 * [fastMoves]/[chargedMoves] carry the `legacy` marker on each entry; [recommended] is the ranked
 * fast+charged pairing, or null when the pool has no recommendation (e.g. no charged move).
 */
data class SpeciesMovesDto(
    val speciesId: String,
    val fastMoves: List<MoveDto>,
    val chargedMoves: List<MoveDto>,
    val recommended: RecommendedMovesetDto?,
)