package no.rauboti.pokedex.move

import no.rauboti.pokedex.common.NotFoundException
import no.rauboti.pokedex.move.dto.RecommendedMovesetDto
import no.rauboti.pokedex.move.dto.SpeciesMovesDto
import no.rauboti.pokedex.species.SpeciesService
import org.springframework.stereotype.Service

/**
 * Assembles a species' move pool and recommendation. Existence is decided by the species row, and the
 * sync-stored recommendation is surfaced only when both ids are present.
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
