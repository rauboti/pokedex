package no.rauboti.pokedex.pokemon

import no.rauboti.pokedex.common.BadRequestException
import no.rauboti.pokedex.common.NotFoundException
import no.rauboti.pokedex.species.SpeciesRepository
import no.rauboti.pokedex.stats.CpmTable
import no.rauboti.pokedex.stats.DustTable
import no.rauboti.pokedex.stats.LevelSolver
import no.rauboti.pokedex.stats.StatFormulas
import org.springframework.stereotype.Service

/**
 * The stateless CP→level derivation (US1, research D7): bridges the species catalog and the pure
 * stats module. Validates the input, resolves the species' base stats, runs the solver, and builds a
 * candidate (level + derived HP/effective stats + dust hint) for every matching level. Zero
 * candidates means the (species, IVs, CP) combination is impossible (SC-004). The registrable check
 * lives in the write path (T017) — derivation is a read-only preview for any known species.
 */
@Service
class DerivationService(
    private val species: SpeciesRepository,
) {
    fun derive(request: DerivationRequest): DerivationResult {
        validate(request)
        val found =
            species.findById(request.speciesId)
                ?: throw NotFoundException("unknown-species", "No species with id '${request.speciesId}'")

        val candidates =
            LevelSolver
                .solve(
                    found.baseAtk,
                    found.baseDef,
                    found.baseSta,
                    request.ivAtk,
                    request.ivDef,
                    request.ivSta,
                    request.cp,
                ).map { level ->
                    val cpm = CpmTable.cpm(level)
                    val effective =
                        StatFormulas.effectiveStats(
                            found.baseAtk,
                            found.baseDef,
                            found.baseSta,
                            request.ivAtk,
                            request.ivDef,
                            request.ivSta,
                            cpm,
                        )
                    DerivationCandidate(
                        level = level,
                        hp = StatFormulas.hp(found.baseSta, request.ivSta, cpm),
                        attack = effective.attack,
                        defense = effective.defense,
                        stamina = effective.stamina,
                        // No power-up cost beyond the level cap; harmless 0 there (a hint only, and
                        // high-level results are never collisions anyway).
                        dustCost = DustTable.dust(level) ?: 0,
                    )
                }
        return DerivationResult(candidates)
    }

    private fun validate(request: DerivationRequest) {
        if (request.ivAtk !in IV_RANGE || request.ivDef !in IV_RANGE || request.ivSta !in IV_RANGE) {
            throw BadRequestException("invalid-ivs", "Each IV must be between 0 and 15")
        }
        if (request.cp < MIN_CP) {
            throw BadRequestException("invalid-cp", "CP must be at least $MIN_CP")
        }
    }

    private companion object {
        val IV_RANGE = 0..15
        const val MIN_CP = 10
    }
}
