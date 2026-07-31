package no.rauboti.pokedex.catalog.domain

import java.time.Instant

/**
 * Catalog freshness (contract `CatalogStatus`). [syncedAt] is null until the first successful sync;
 * [stalePokemonCount] is **caller-scoped**, never a cross-user total.
 */
data class CatalogStatus(
    val speciesCount: Long,
    val moveCount: Long,
    val syncedAt: Instant?,
    val stalePokemonCount: Long,
)
