package no.rauboti.pokedex.catalog.sync

import no.rauboti.pokedex.catalog.sync.domain.NormalizedCatalog
import no.rauboti.pokedex.move.MoveService
import no.rauboti.pokedex.move.MovesetRanker
import no.rauboti.pokedex.move.SpeciesMoveRepository
import no.rauboti.pokedex.move.domain.RankableMove
import no.rauboti.pokedex.species.SpeciesService
import org.springframework.stereotype.Service
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate
import java.time.Instant

/**
 * Runs a full catalog sync — see the api README ("Catalog sync") for the stage order and failure
 * semantics. The two invariants worth keeping in view here: fetch and normalization happen *outside*
 * the transaction, so a bad source leaves the catalog untouched, and the upserts run in FK order
 * (moves before species before pools).
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
     * Runs against the in-memory normalized catalog — the moves it references were just committed, so
     * the recommended-move FKs resolve.
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

    private fun rescanStaleness() {
        stalenessRescan.rescan()
    }
}
