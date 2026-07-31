package no.rauboti.pokedex.derivation

import no.rauboti.pokedex.derivation.domain.DerivationRequest
import no.rauboti.pokedex.derivation.domain.DerivationResult
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController

/**
 * `POST /api/derivation` — lets the registration form show candidate levels before saving, with no
 * provisional write.
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
