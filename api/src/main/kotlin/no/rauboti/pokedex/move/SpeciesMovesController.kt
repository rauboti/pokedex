package no.rauboti.pokedex.move

import no.rauboti.pokedex.move.dto.SpeciesMovesDto
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RestController

/** `GET /api/species/{id}/moves` — move pool plus recommended moveset. Unknown species → 404. */
@RestController
class SpeciesMovesController(
    private val speciesMovesService: SpeciesMovesService,
) {
    @GetMapping("/api/species/{id}/moves")
    fun moves(
        @PathVariable id: String,
    ): SpeciesMovesDto = speciesMovesService.movesFor(id)
}
