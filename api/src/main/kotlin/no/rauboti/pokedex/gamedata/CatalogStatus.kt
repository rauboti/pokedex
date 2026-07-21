package no.rauboti.pokedex.gamedata

import java.time.Instant

/**
 * Catalog sync status (contract schema `CatalogStatus`) for the "catalog freshness" UI. [syncedAt]
 * is null until the first successful sync; [stalePokemonCount] is **caller-scoped** — the
 * authenticated user's own Pokémon currently flagged stale (FR-013), never other users' rows.
 */
data class CatalogStatus(
    val speciesCount: Long,
    val moveCount: Long,
    val syncedAt: Instant?,
    val stalePokemonCount: Long,
)
