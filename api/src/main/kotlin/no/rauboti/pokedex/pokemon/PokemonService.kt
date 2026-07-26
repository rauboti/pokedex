package no.rauboti.pokedex.pokemon

import no.rauboti.pokedex.caughtpokemon.CaughtPokemonService
import no.rauboti.pokedex.caughtpokemon.domain.CaughtBasePokemon
import no.rauboti.pokedex.caughtpokemon.domain.CaughtPokemon
import no.rauboti.pokedex.caughtpokemon.domain.CreateCaughtPokemon
import no.rauboti.pokedex.caughtpokemon.domain.PatchCaughtPokemon
import no.rauboti.pokedex.common.NotFoundException
import no.rauboti.pokedex.common.UnprocessableException
import no.rauboti.pokedex.derivation.dto.DerivedDto
import no.rauboti.pokedex.derivation.dto.DerivedProjectionDto
import no.rauboti.pokedex.move.MoveService
import no.rauboti.pokedex.move.dto.MoveDto
import no.rauboti.pokedex.move.dto.MoveSetDto
import no.rauboti.pokedex.pokemon.dto.FlagsDto
import no.rauboti.pokedex.pokemon.dto.PokemonDto
import no.rauboti.pokedex.species.SpeciesService
import no.rauboti.pokedex.species.domain.Species
import no.rauboti.pokedex.stats.CpmTable
import no.rauboti.pokedex.stats.LevelSolver
import no.rauboti.pokedex.stats.Projections
import no.rauboti.pokedex.stats.StatFormulas
import org.springframework.stereotype.Service
import java.util.UUID

/**
 * The Pokémon CRUD domain logic. Enforces the data-model write invariants on every write:
 *  0. the species must be registrable (mega/temporary forms rejected on create and species change);
 *  1. the solver must confirm (species, IVs, CP) → level — ambiguous requires a chosen candidate,
 *     no match is a 422;
 *  2. recorded moves must be in the species pool and fast/charged-slot correct;
 *  3. an edit touching species/IVs/CP re-derives the level and clears `stale`.
 * All reads are user-scoped and carry the server-computed derived block.
 */
@Service
class PokemonService(
    private val caughtPokemonService: CaughtPokemonService,
    private val moveService: MoveService,
    private val speciesService: SpeciesService,
) {
    fun list(userId: String): List<PokemonDto> {
        val rows = caughtPokemonService.findByUserId(userId)
        if (rows.isEmpty()) return emptyList()
        val speciesById = speciesService.findByIds(rows.map { it.speciesId }.toSet()).associateBy { it.id }
        val movesById = moveService.findByIds(rows.flatMap { it.recordedMoveIds() }.toSet()).associateBy { it.id }
        return rows.map { assemble(it, speciesById.getValue(it.speciesId), movesById) }
    }

    fun get(
        userId: String,
        id: UUID,
    ): PokemonDto? {
        val row = caughtPokemonService.findByUserIdAndId(id, userId) ?: return null
        val species = speciesService.findById(row.speciesId) ?: return null
        return assemble(row, species, movesById(row.recordedMoveIds()))
    }

    fun create(
        userId: String,
        input: CreateCaughtPokemon,
    ): PokemonDto {
        validateIvsCp(input.ivAtk, input.ivDef, input.ivSta, input.cp)
        val species =
            speciesService.findById(input.speciesId)
                ?: throw NotFoundException("unknown-species", "No species with id '${input.speciesId}'")
        requireRegistrable(input.speciesId)
        val level = confirmLevel(species, input.ivAtk, input.ivDef, input.ivSta, input.cp, input.level)
        validateMoves(species.id, input.fastMoveId, input.chargedMove1Id, input.chargedMove2Id)

        val saved =
            caughtPokemonService.save(
                CaughtBasePokemon(
                    userId = userId,
                    speciesId = species.id,
                    ivAtk = input.ivAtk,
                    ivDef = input.ivDef,
                    ivSta = input.ivSta,
                    cp = input.cp,
                    level = level,
                    stale = false,
                    shiny = input.shiny,
                    shadow = input.shadow,
                    lucky = input.lucky,
                    purified = input.purified,
                    bestBuddy = input.bestBuddy,
                    fastMoveId = input.fastMoveId,
                    charged1MoveId = input.chargedMove1Id,
                    charged2MoveId = input.chargedMove2Id,
                    caughtAt = input.caughtAt,
                ),
            )
        return assemble(saved, species, movesById(saved.recordedMoveIds()))
    }

    fun update(
        userId: String,
        id: UUID,
        patch: PatchCaughtPokemon,
    ): PokemonDto? {
        val existing = caughtPokemonService.findByUserIdAndId(id, userId) ?: return null

        val speciesId = patch.speciesId ?: existing.speciesId
        val ivAtk = patch.ivAtk ?: existing.ivAtk
        val ivDef = patch.ivDef ?: existing.ivDef
        val ivSta = patch.ivSta ?: existing.ivSta
        val cp = patch.cp ?: existing.cp
        val species =
            speciesService.findById(speciesId)
                ?: throw NotFoundException("unknown-species", "No species with id '$speciesId'")
        if (patch.speciesId != null) requireRegistrable(speciesId)

        // Invariant 3: re-derive + clear stale only when the derivation inputs change.
        val reDerive =
            patch.speciesId != null ||
                patch.ivAtk != null ||
                patch.ivDef != null ||
                patch.ivSta != null ||
                patch.cp != null
        val level: Double
        val stale: Boolean
        if (reDerive) {
            validateIvsCp(ivAtk, ivDef, ivSta, cp)
            level = confirmLevel(species, ivAtk, ivDef, ivSta, cp, patch.level)
            stale = false
        } else {
            level = existing.level
            stale = existing.stale
        }

        val fast = patch.fastMoveId ?: existing.fastMoveId
        val charged1 = patch.chargedMove1Id ?: existing.charged1MoveId
        val charged2 = patch.chargedMove2Id ?: existing.charged2MoveId
        validateMoves(speciesId, fast, charged1, charged2)

        val updated =
            caughtPokemonService.update(
                existing.copy(
                    speciesId = speciesId,
                    ivAtk = ivAtk,
                    ivDef = ivDef,
                    ivSta = ivSta,
                    cp = cp,
                    level = level,
                    stale = stale,
                    shiny = patch.shiny ?: existing.shiny,
                    shadow = patch.shadow ?: existing.shadow,
                    lucky = patch.lucky ?: existing.lucky,
                    purified = patch.purified ?: existing.purified,
                    bestBuddy = patch.bestBuddy ?: existing.bestBuddy,
                    fastMoveId = fast,
                    charged1MoveId = charged1,
                    charged2MoveId = charged2,
                    caughtAt = patch.caughtAt ?: existing.caughtAt,
                ),
            ) ?: return null
        return assemble(updated, species, movesById(updated.recordedMoveIds()))
    }

    fun delete(
        userId: String,
        id: UUID,
    ): Boolean = caughtPokemonService.delete(id, userId)

    // --- invariants -----------------------------------------------------------------------------

    private fun validateIvsCp(
        ivAtk: Int,
        ivDef: Int,
        ivSta: Int,
        cp: Int,
    ) {
        if (ivAtk !in IV_RANGE || ivDef !in IV_RANGE || ivSta !in IV_RANGE || cp < MIN_CP) {
            throw UnprocessableException("impossible-combination", "IVs must be 0–15 and CP at least $MIN_CP")
        }
    }

    private fun requireRegistrable(speciesId: String) {
        if (speciesService.isRegistrable(speciesId) != true) {
            throw UnprocessableException(
                "species-not-registrable",
                "Species '$speciesId' cannot be registered (a mega or temporary battle form)",
            )
        }
    }

    private fun confirmLevel(
        species: Species,
        ivAtk: Int,
        ivDef: Int,
        ivSta: Int,
        cp: Int,
        requested: Double?,
    ): Double {
        val candidates = LevelSolver.solve(species.baseAtk, species.baseDef, species.baseSta, ivAtk, ivDef, ivSta, cp)
        if (candidates.isEmpty()) {
            throw UnprocessableException("impossible-combination", "No level yields CP $cp for those IVs")
        }
        return when {
            requested != null && requested in candidates -> requested
            requested == null && candidates.size == 1 -> candidates.single()
            else ->
                throw UnprocessableException(
                    "level-not-a-candidate",
                    "CP $cp is ambiguous — choose one of these levels: ${candidates.joinToString()}",
                )
        }
    }

    private fun validateMoves(
        speciesId: String,
        fast: String?,
        charged1: String?,
        charged2: String?,
    ) {
        val ids = listOfNotNull(fast, charged1, charged2)
        if (ids.isEmpty()) return
        val pool = moveService.poolMoveIds(speciesId)
        val byId = moveService.findByIds(ids).associateBy { it.id }
        fast?.let { requireSlot(it, pool, byId, wantFast = true) }
        charged1?.let { requireSlot(it, pool, byId, wantFast = false) }
        charged2?.let { requireSlot(it, pool, byId, wantFast = false) }
    }

    private fun requireSlot(
        id: String,
        pool: Set<String>,
        byId: Map<String, MoveDto>,
        wantFast: Boolean,
    ) {
        val move = byId[id] ?: throw UnprocessableException("move-not-in-pool", "Unknown move '$id'")
        if (id !in pool) {
            throw UnprocessableException("move-not-in-pool", "'$id' is not in the species' move pool")
        }
        if (move.fast != wantFast) {
            val slot = if (wantFast) "fast" else "charged"
            throw UnprocessableException("move-not-in-pool", "'$id' is not a valid $slot move")
        }
    }

    // --- assembly -------------------------------------------------------------------------------

    private fun movesById(ids: List<String>): Map<String, MoveDto> = moveService.findByIds(ids.toSet()).associateBy { it.id }

    private fun assemble(
        row: CaughtPokemon,
        species: Species,
        movesById: Map<String, MoveDto>,
    ): PokemonDto {
        val cpm = CpmTable.cpm(row.level)
        val effective =
            StatFormulas.effectiveStats(species.baseAtk, species.baseDef, species.baseSta, row.ivAtk, row.ivDef, row.ivSta, cpm)
        val derived =
            DerivedDto(
                level = row.level,
                hp = StatFormulas.hp(species.baseSta, row.ivSta, cpm),
                attack = effective.attack,
                defense = effective.defense,
                stamina = effective.stamina,
                ivPercent = StatFormulas.ivPercent(row.ivAtk, row.ivDef, row.ivSta),
                perfect = row.ivAtk == 15 && row.ivDef == 15 && row.ivSta == 15,
                projections =
                    Projections
                        .projectionsFor(
                            species.baseAtk,
                            species.baseDef,
                            species.baseSta,
                            row.ivAtk,
                            row.ivDef,
                            row.ivSta,
                            row.level,
                            row.bestBuddy,
                        ).map {
                            DerivedProjectionDto(it.label.name, it.level, it.cp, it.hp, it.attack, it.defense, it.stamina)
                        },
            )
        return PokemonDto(
            id = row.id,
            species = species,
            ivAtk = row.ivAtk,
            ivDef = row.ivDef,
            ivSta = row.ivSta,
            cp = row.cp,
            flags = FlagsDto(row.shiny, row.shadow, row.lucky, row.purified, row.bestBuddy),
            moves =
                MoveSetDto(
                    fast = row.fastMoveId?.let { movesById[it] },
                    charged1 = row.charged1MoveId?.let { movesById[it] },
                    charged2 = row.charged2MoveId?.let { movesById[it] },
                ),
            derived = derived,
            stale = row.stale,
            caughtAt = row.caughtAt,
            createdAt = row.createdAt,
        )
    }

    private fun CaughtPokemon.recordedMoveIds(): List<String> = listOfNotNull(fastMoveId, charged1MoveId, charged2MoveId)

    private companion object {
        val IV_RANGE = 0..15
        const val MIN_CP = 10
    }
}
