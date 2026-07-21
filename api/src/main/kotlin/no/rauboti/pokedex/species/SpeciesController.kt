package no.rauboti.pokedex.species

import no.rauboti.pokedex.common.BadRequestException
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

/**
 * Species search endpoint (`GET /api/species?q=`, US1). `q` is a required, non-blank name substring;
 * `limit` defaults to 20 and is capped at the contract maximum of 50. A missing `q` is a framework
 * 400 (rendered as problem+json); a blank `q` is rejected here.
 */
@RestController
class SpeciesController(
    private val species: SpeciesRepository,
) {
    @GetMapping("/api/species")
    fun search(
        @RequestParam q: String,
        @RequestParam(defaultValue = "20") limit: Int,
    ): List<Species> {
        if (q.isBlank()) {
            throw BadRequestException("invalid-query", "q must be a non-blank search term")
        }
        return species.search(q.trim(), limit.coerceIn(1, MAX_LIMIT))
    }

    private companion object {
        const val MAX_LIMIT = 50
    }
}
