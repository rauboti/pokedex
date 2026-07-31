package no.rauboti.pokedex.catalog

import no.rauboti.pokedex.catalog.domain.CatalogStatus
import no.rauboti.pokedex.catalog.sync.SyncService
import no.rauboti.pokedex.caughtpokemon.CaughtPokemonService
import no.rauboti.pokedex.move.MoveService
import no.rauboti.pokedex.species.SpeciesService
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RestController

/**
 * The catalog endpoints. The admin-only gate on sync lives in the security chain, not here; the
 * caller's `sub` scopes the stale count.
 */
@RestController
class CatalogController(
    private val caughtPokemonService: CaughtPokemonService,
    private val moveService: MoveService,
    private val speciesService: SpeciesService,
    private val syncService: SyncService,
) {
    @GetMapping("/api/catalog")
    fun status(
        @AuthenticationPrincipal jwt: Jwt,
    ): CatalogStatus = catalogStatus(jwt.subject)

    @PostMapping("/api/catalog/sync")
    fun sync(
        @AuthenticationPrincipal jwt: Jwt,
    ): CatalogStatus {
        syncService.sync()
        return catalogStatus(jwt.subject)
    }

    private fun catalogStatus(sub: String?): CatalogStatus {
        val userId = requireNotNull(sub) { "authenticated request without a sub" }
        return CatalogStatus(
            speciesCount = speciesService.count(),
            moveCount = moveService.count(),
            syncedAt = speciesService.lastSyncedAt(),
            stalePokemonCount = caughtPokemonService.countStaleByUserId(userId),
        )
    }
}
