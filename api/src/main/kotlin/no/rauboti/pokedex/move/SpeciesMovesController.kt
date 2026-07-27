package no.rauboti.pokedex.move

import no.rauboti.pokedex.move.dto.SpeciesMovesDto
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RestController

/**
 * Move pool + recommended moveset for a species (`GET /api/species/{id}/moves`, US5). An unknown
 * species is a 404 (thrown in [SpeciesMovesService]); authentication is enforced by the security
 * config like every other `/api` route.
 */
@RestController
class SpeciesMovesController(
    private val speciesMovesService: SpeciesMovesService,
) {
    @GetMapping("/api/species/{id}/moves")
    fun moves(
        @PathVariable id: String,
    ): SpeciesMovesDto = speciesMovesService.movesFor(id)
}
