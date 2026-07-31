package no.rauboti.pokedex.catalog

import no.rauboti.pokedex.catalog.sync.SyncService
import no.rauboti.pokedex.common.GamedataUnavailableException
import no.rauboti.pokedex.species.SpeciesService
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.context.event.ApplicationReadyEvent
import org.springframework.context.event.EventListener
import org.springframework.stereotype.Component

/**
 * Runs one sync at startup when the catalog is empty. Best-effort: an unavailable source must not stop
 * the app from starting, since an admin can trigger a sync later.
 */
@Component
class CatalogInitializer(
    private val syncService: SyncService,
    private val speciesService: SpeciesService,
    @param:Value("\${pokedex.gamedata.sync-on-startup:true}") private val syncOnStartup: Boolean,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @EventListener(ApplicationReadyEvent::class)
    fun syncWhenEmpty() {
        if (!syncOnStartup || speciesService.count() > 0) return
        try {
            syncService.sync()
            log.info("Startup catalog sync complete ({} species)", speciesService.count())
        } catch (e: GamedataUnavailableException) {
            log.warn("Startup catalog sync skipped — game-data source unavailable: {}", e.message)
        }
    }
}
