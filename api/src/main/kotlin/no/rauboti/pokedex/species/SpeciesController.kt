package no.rauboti.pokedex.species

import no.rauboti.pokedex.common.BadRequestException
import no.rauboti.pokedex.species.SpeciesService
import no.rauboti.pokedex.species.domain.Species
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

/**
 * `GET /api/species?q=` — name-substring search, `limit` capped at the contract maximum. A missing `q`
 * is a framework 400; a blank one is rejected here.
 */
@RestController
class SpeciesController(
    private val speciesService: SpeciesService,
) {
    @GetMapping("/api/species")
    fun search(
        @RequestParam q: String,
        @RequestParam(defaultValue = "20") limit: Int,
    ): List<Species> {
        if (q.isBlank()) {
            throw BadRequestException("invalid-query", "q must be a non-blank search term")
        }
        return speciesService.search(q.trim(), limit.coerceIn(1, MAX_LIMIT))
    }

    private companion object {
        const val MAX_LIMIT = 50
    }
}
