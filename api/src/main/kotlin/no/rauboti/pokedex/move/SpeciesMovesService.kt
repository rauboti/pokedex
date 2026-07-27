package no.rauboti.pokedex.move

import no.rauboti.pokedex.common.NotFoundException
import no.rauboti.pokedex.species.SpeciesService
import no.rauboti.pokedex.move.dto.RecommendedMovesetDto
import no.rauboti.pokedex.move.dto.SpeciesMovesDto
import org.springframework.stereotype.Service

/**
 * Assembles a species' move pool + recommendation for `GET /api/species/{id}/moves`. Existence is
 * decided by the species row (a 404 for an unknown id); the pool comes from `species_move` with
 * legacy markers, and the recommendation is the sync-stored pairing — surfaced only when both ids
 * are present.
 */
@Service
class SpeciesMovesService(
    private val speciesService: SpeciesService,
    private val speciesMoveRepository: SpeciesMoveRepository,
) {
    fun movesFor(speciesId: String): SpeciesMovesDto {
        val recommendedIds =
            speciesService.findRecommendedMoveIds(speciesId)
                ?: throw NotFoundException("unknown-species", "No species with id '$speciesId'")

        val pool = speciesMoveRepository.findPoolMoves(speciesId)
        val recommended =
            if (recommendedIds.fastMoveId != null && recommendedIds.chargedMoveId != null) {
                RecommendedMovesetDto(recommendedIds.fastMoveId, recommendedIds.chargedMoveId)
            } else {
                null
            }

        return SpeciesMovesDto(
            speciesId = speciesId,
            fastMoves = pool.filter { it.fast },
            chargedMoves = pool.filterNot { it.fast },
            recommended = recommended,
        )
    }
}
