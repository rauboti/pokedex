package no.rauboti.pokedex.catalog.sync

import no.rauboti.pokedex.caughtpokemon.CaughtPokemonService
import no.rauboti.pokedex.species.SpeciesService
import no.rauboti.pokedex.stats.LevelSolver
import org.springframework.stereotype.Component

/**
 * Re-derives every caught Pokémon against the refreshed base stats after a sync and flags the ones a
 * rebalance has moved out from under (FR-013).
 *
 * Flagging is **monotonic**: this only ever sets `stale`, never clears it — clearing is a re-deriving
 * edit's job — so a player's correction is never silently undone by a later sync.
 */
@Component
class StalenessRescan(
    private val caughtPokemonService: CaughtPokemonService,
    private val speciesService: SpeciesService,
) {
    fun rescan() {
        val rows = caughtPokemonService.findAll().filterNot { it.stale }
        if (rows.isEmpty()) return
        val speciesById = speciesService.findByIds(rows.map { it.speciesId }.toSet()).associateBy { it.id }

        val staleIds =
            rows
                .filter { row ->
                    val s = speciesById[row.speciesId] ?: return@filter false
                    row.level !in
                        LevelSolver.solve(s.baseAtk, s.baseDef, s.baseSta, row.ivAtk, row.ivDef, row.ivSta, row.cp)
                }.map { it.id }

        caughtPokemonService.markAsStale(staleIds)
    }
}
