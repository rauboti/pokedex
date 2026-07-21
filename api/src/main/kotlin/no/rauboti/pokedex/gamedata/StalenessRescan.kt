package no.rauboti.pokedex.gamedata

import no.rauboti.pokedex.pokemon.CaughtPokemonRepository
import no.rauboti.pokedex.species.SpeciesRepository
import no.rauboti.pokedex.stats.LevelSolver
import org.springframework.stereotype.Component

/**
 * The post-sync staleness rescan (FR-013/SC-005, T018 — closes the [SyncService] no-op seam). After a
 * successful catalog sync, re-derives every caught Pokémon against the *refreshed* base stats: if its
 * stored `level` no longer appears among the solver's candidates for (base stats, IVs, CP), a rebalance
 * has moved the math out from under it and the row is flagged `stale` so the player re-checks it.
 *
 * Flagging is **monotonic** — the rescan only ever *sets* `stale=true`; the flag is cleared solely by a
 * re-deriving edit ([no.rauboti.pokedex.pokemon.PokemonService] write invariant 3), so a player's
 * correction is never silently undone by a later sync. Species rows are never deleted by a sync, so a
 * caught row's species is expected to resolve; a defensive miss leaves the row untouched.
 */
@Component
class StalenessRescan(
    private val caught: CaughtPokemonRepository,
    private val species: SpeciesRepository,
) {
    fun rescan() {
        val rows = caught.listAll().filterNot { it.stale } // already-flagged rows need no recheck
        if (rows.isEmpty()) return
        val speciesById = species.findByIds(rows.map { it.speciesId }.toSet()).associateBy { it.id }

        val staleIds =
            rows
                .filter { row ->
                    val s = speciesById[row.speciesId] ?: return@filter false
                    row.level !in
                        LevelSolver.solve(s.baseAtk, s.baseDef, s.baseSta, row.ivAtk, row.ivDef, row.ivSta, row.cp)
                }.map { it.id }

        caught.markStale(staleIds)
    }
}
