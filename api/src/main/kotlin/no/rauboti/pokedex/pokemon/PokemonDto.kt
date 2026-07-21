package no.rauboti.pokedex.pokemon

import no.rauboti.pokedex.species.Species
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

/**
 * A registered Pokémon as the API returns it (contract `Pokemon`, US1). The `derived` block (level,
 * HP, effective stats, IV%, projections) is computed server-side on every read (research D7); the
 * web app does no stat math. `moves` carries the resolved recorded moves (null = unrecorded).
 */
data class PokemonDto(
    val id: UUID,
    val species: Species,
    val ivAtk: Int,
    val ivDef: Int,
    val ivSta: Int,
    val cp: Int,
    val flags: FlagsDto,
    val moves: MovesDto,
    val derived: DerivedDto,
    val stale: Boolean,
    val caughtAt: LocalDate?,
    val createdAt: Instant,
)

data class FlagsDto(
    val shiny: Boolean,
    val shadow: Boolean,
    val lucky: Boolean,
    val purified: Boolean,
    val bestBuddy: Boolean,
)

data class MovesDto(
    val fast: MoveDto?,
    val charged1: MoveDto?,
    val charged2: MoveDto?,
)

/** A move as the API returns it (contract `Move`). `legacy` is populated on pool listings (T028); on
 *  a Pokémon's recorded moves it is left null. */
data class MoveDto(
    val id: String,
    val name: String,
    val type: String,
    val fast: Boolean,
    val legacy: Boolean? = null,
)

/** The server-computed derived block (contract `Derived`). */
data class DerivedDto(
    val level: Double,
    val hp: Int,
    val attack: Double,
    val defense: Double,
    val stamina: Double,
    val ivPercent: Double,
    val perfect: Boolean,
    val projections: List<ProjectionDto>,
)

/** One projected level row (contract `Derived.projections[]`); `label` is L40/L50/BEST_BUDDY. */
data class ProjectionDto(
    val label: String,
    val level: Double,
    val cp: Int,
    val hp: Int,
    val attack: Double,
    val defense: Double,
    val stamina: Double,
)
