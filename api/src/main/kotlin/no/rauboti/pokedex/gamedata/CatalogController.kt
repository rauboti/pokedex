package no.rauboti.pokedex.gamedata

import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RestController

/**
 * The catalog endpoints (research D5). `GET /api/catalog` reports counts, last-sync time and the
 * caller's stale count for the freshness UI; `POST /api/catalog/sync` triggers a sync and returns the
 * refreshed status. The admin-only gate on sync lives in the security chain
 * ([no.rauboti.pokedex.config.SecurityConfig] maps `POST /api/catalog/sync` to `hasRole("admin")`);
 * both endpoints require an authenticated pokedex user. The caller's `sub` scopes the stale count.
 */
@RestController
class CatalogController(
    private val syncService: SyncService,
    private val catalog: CatalogRepository,
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
            speciesCount = catalog.speciesCount(),
            moveCount = catalog.moveCount(),
            syncedAt = catalog.lastSyncedAt(),
            stalePokemonCount = catalog.stalePokemonCount(userId),
        )
    }
}
