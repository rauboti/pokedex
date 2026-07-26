package no.rauboti.pokedex.pokemon.dto

import no.rauboti.pokedex.derivation.dto.DerivedDto
import no.rauboti.pokedex.move.dto.MoveSetDto
import no.rauboti.pokedex.species.domain.Species
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

/**
 * A registered Pokémon as the API returns it (contract `Pokemon`). The `derived` block (level, HP,
 * effective stats, IV%, projections) is computed server-side on every read; the web app does no
 * stat math. `moves` carries the resolved recorded moves (null = unrecorded).
 */
data class PokemonDto(
    val id: UUID,
    val species: Species,
    val ivAtk: Int,
    val ivDef: Int,
    val ivSta: Int,
    val cp: Int,
    val flags: FlagsDto,
    val moves: MoveSetDto,
    val derived: DerivedDto,
    val stale: Boolean,
    val caughtAt: LocalDate?,
    val createdAt: Instant,
)