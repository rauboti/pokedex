package no.rauboti.pokedex.pokemon

import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController

/**
 * The stateless derivation preview (`POST /api/derivation`, US1). Lets the registration form show
 * the candidate level(s) — with dust hints — before saving, without a provisional write (research
 * D7). Delegates to [DerivationService]; unknown species → 404, invalid IV/CP → 400.
 */
@RestController
class DerivationController(
    private val derivation: DerivationService,
) {
    @PostMapping("/api/derivation")
    fun derive(
        @RequestBody request: DerivationRequest,
    ): DerivationResult = derivation.derive(request)
}
