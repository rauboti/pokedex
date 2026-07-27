package no.rauboti.pokedex.catalog.sync

import no.rauboti.pokedex.catalog.sync.domain.NormalizedCatalog
import no.rauboti.pokedex.move.MovesetRanker
import no.rauboti.pokedex.move.domain.RankableMove
import no.rauboti.pokedex.move.MoveService
import no.rauboti.pokedex.species.SpeciesService
import no.rauboti.pokedex.move.SpeciesMoveRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate
import java.time.Instant

/**
 * Runs a full catalog sync: fetch the feed, normalize it, and upsert species/move/species_move.
 * The network fetch and pure normalization happen **outside** the transaction; only the DB writes
 * are wrapped in one — so a source failure (client throw) or a malformed feed (normalizer throw)
 * surfaces [no.rauboti.pokedex.common.GamedataUnavailableException] before anything is written,
 * leaving the catalog unchanged, and any mid-write failure rolls the whole batch back.
 *
 * Upsert order respects the FKs: moves first (a pool row references `move`), then species, then each
 * species' pool is replaced wholesale. Species/move rows are never deleted. After the write
 * transaction commits, two passes run against the freshly-persisted catalog: the moveset ranker
 * ([MovesetRanker]) writes each species' `recommended_*_move_id`, and the staleness rescan
 * ([StalenessRescan]) flags rebalanced caught Pokémon.
 */
@Service
class SyncService(
    private val gamedataClient: GamedataClient,
    private val gamedataNormalizer: GamedataNormalizer,
    private val moveService: MoveService,
    private val speciesMoveRepo: SpeciesMoveRepository,
    private val speciesService: SpeciesService,
    private val stalenessRescan: StalenessRescan,
    txManager: PlatformTransactionManager,
) {
    private val tx = TransactionTemplate(txManager)

    fun sync() {
        val normalized = gamedataNormalizer.normalize(gamedataClient.fetchPokedex())
        val syncedAt = Instant.now()

        tx.executeWithoutResult {
            normalized.moves.forEach { moveService.upsert(it, syncedAt) }
            normalized.species.forEach { speciesService.upsert(it, syncedAt) }
            val poolBySpecies = normalized.pool.groupBy { it.speciesId }
            normalized.species.forEach { speciesMoveRepo.replacePool(it.id, poolBySpecies[it.id].orEmpty()) }
        }

        rankMovesets(normalized)
        rescanStaleness()
    }

    /**
     * Rank each species' pool by cycle DPS ([MovesetRanker]) and store the winning pairing on the
     * species row (null when the pool has no fast+charged pair). Runs against the in-memory normalized
     * catalog — the moves it references were just committed, so the recommended-move FKs resolve.
     */
    private fun rankMovesets(catalog: NormalizedCatalog) {
        val moveById = catalog.moves.associateBy { it.id }
        val poolBySpecies = catalog.pool.groupBy { it.speciesId }

        for (species in catalog.species) {
            val pool =
                poolBySpecies[species.id]
                    .orEmpty()
                    .mapNotNull { entry ->
                        moveById[entry.moveId]?.let { m ->
                            RankableMove(m.id, m.type, m.isFast, m.power, m.energy, m.durationMs)
                        }
                    }
            val recommended = MovesetRanker.recommend(listOfNotNull(species.type1, species.type2), pool)
            speciesService.updateRecommendedMoves(
                species.id,
                recommended?.fastMoveId,
                recommended?.chargedMoveId,
            )
        }
    }

    /** Re-derive each caught Pokémon against the refreshed stats and flag mismatches. */
    private fun rescanStaleness() {
        stalenessRescan.rescan()
    }
}
