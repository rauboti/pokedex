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
 * species' pool is replaced wholesale. Species/move rows are never deleted. Two post-sync seams are
 * deliberate no-ops until their tasks land: the moveset ranker (writes `recommended_*_move_id`, T028)
 * and the staleness rescan (flags rebalanced caught Pokémon, T018).
 */
@Service
class SyncService(
    private val client: GamedataClient,
    private val normalizer: GamedataNormalizer,
    private val catalog: CatalogRepository,
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

    /** No-op seam: re-derive each caught Pokémon against refreshed stats and flag mismatches (FR-013, T018). */
    private fun rescanStaleness() {
        // Implemented in T018.
    }
}
