package no.rauboti.pokedex.gamedata

import no.rauboti.pokedex.common.GamedataUnavailableException
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.context.event.ApplicationReadyEvent
import org.springframework.context.event.EventListener
import org.springframework.stereotype.Component

/**
 * Populates the catalog on first boot: when the app is ready and the catalog is empty, run one sync
 * (research D5 — startup-when-empty). Best-effort — if the game-data source is unavailable the app
 * still starts (an admin can trigger `POST /api/catalog/sync` later); a populated catalog is left
 * untouched. Disabled under `pokedex.gamedata.sync-on-startup=false` (set in the test profile so the
 * suite never reaches for the network).
 */
@Component
class CatalogInitializer(
    private val syncService: SyncService,
    private val catalog: CatalogRepository,
    @param:Value("\${pokedex.gamedata.sync-on-startup:true}") private val syncOnStartup: Boolean,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @EventListener(ApplicationReadyEvent::class)
    fun syncWhenEmpty() {
        if (!syncOnStartup || catalog.speciesCount() > 0) return
        try {
            syncService.sync()
            log.info("Startup catalog sync complete ({} species)", catalog.speciesCount())
        } catch (e: GamedataUnavailableException) {
            log.warn("Startup catalog sync skipped — game-data source unavailable: {}", e.message)
        }
    }
}
