package no.rauboti.pokedex.gamedata

import org.springframework.stereotype.Service
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate
import java.time.Instant

/**
 * Runs a full catalog sync (research D5): fetch the feed, normalize it, and upsert
 * species/move/species_move. The network fetch and pure normalization happen **outside** the
 * transaction; only the DB writes are wrapped in one — so a source failure (client throw) or a
 * malformed feed (normalizer throw) surfaces [no.rauboti.pokedex.common.GamedataUnavailableException]
 * before anything is written, leaving the catalog unchanged, and any mid-write failure rolls the
 * whole batch back.
 *
 * Upsert order respects the FKs: moves first (a pool row references `move`), then species, then each
 * species' pool is replaced wholesale. Species/move rows are never deleted. The moveset ranker (writes
 * `recommended_*_move_id`, T028) is still a deliberate no-op seam; the staleness rescan (flags
 * rebalanced caught Pokémon, FR-013/T018) is now live in [StalenessRescan]. Both run after the write
 * transaction commits, against the freshly-persisted catalog.
 */
@Service
class SyncService(
    private val client: GamedataClient,
    private val normalizer: GamedataNormalizer,
    private val catalog: CatalogRepository,
    private val stalenessRescan: StalenessRescan,
    txManager: PlatformTransactionManager,
) {
    private val tx = TransactionTemplate(txManager)

    fun sync() {
        val normalized = normalizer.normalize(client.fetchPokedex())
        val syncedAt = Instant.now()

        tx.executeWithoutResult {
            normalized.moves.forEach { catalog.upsertMove(it, syncedAt) }
            normalized.species.forEach { catalog.upsertSpecies(it, syncedAt) }
            val poolBySpecies = normalized.pool.groupBy { it.speciesId }
            normalized.species.forEach { catalog.replacePool(it.id, poolBySpecies[it.id].orEmpty()) }
        }

        rankMovesets(normalized)
        rescanStaleness()
    }

    /** No-op seam: rank each species' pool and store `recommended_*_move_id` (research D8, T028). */
    @Suppress("UNUSED_PARAMETER")
    private fun rankMovesets(catalog: NormalizedCatalog) {
        // Implemented in T028; species.recommended_*_move_id stays null until then.
    }

    /** Re-derive each caught Pokémon against the refreshed stats and flag mismatches (FR-013, T018). */
    private fun rescanStaleness() {
        stalenessRescan.rescan()
    }
}
