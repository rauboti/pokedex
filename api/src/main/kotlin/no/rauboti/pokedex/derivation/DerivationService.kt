package no.rauboti.pokedex.derivation

import no.rauboti.pokedex.common.BadRequestException
import no.rauboti.pokedex.common.NotFoundException
import no.rauboti.pokedex.derivation.domain.DerivationCandidate
import no.rauboti.pokedex.derivation.domain.DerivationRequest
import no.rauboti.pokedex.derivation.domain.DerivationResult
import no.rauboti.pokedex.species.SpeciesService
import no.rauboti.pokedex.stats.CpmTable
import no.rauboti.pokedex.stats.DustTable
import no.rauboti.pokedex.stats.LevelSolver
import no.rauboti.pokedex.stats.StatFormulas
import org.springframework.stereotype.Service

/**
 * The stateless CP→level derivation preview: one candidate per matching level, zero when the
 * combination is impossible. No registrable check — that belongs to the write path.
 */
@Service
class DerivationService(
    private val speciesService: SpeciesService,
) {
    fun derive(request: DerivationRequest): DerivationResult {
        validate(request)
        val found =
            speciesService.findById(request.speciesId)
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
                        // 0 past the level cap — a display hint only, and those are never collisions.
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
