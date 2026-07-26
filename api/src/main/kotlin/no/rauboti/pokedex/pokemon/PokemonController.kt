package no.rauboti.pokedex.pokemon

import no.rauboti.pokedex.caughtpokemon.domain.CreateCaughtPokemon
import no.rauboti.pokedex.caughtpokemon.domain.PatchCaughtPokemon
import no.rauboti.pokedex.common.NotFoundException
import no.rauboti.pokedex.pokemon.dto.PokemonDto
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

/**
 * The caller's Pokémon collection. All operations are scoped to the authenticated user's hive
 * `sub`; a by-id read/edit/delete of a row the caller doesn't own is a 404, indistinguishable
 * from an unknown id. Create/edit run the solver and the write invariants in [PokemonService];
 * every response carries the server-computed derived block.
 */
@RestController
class PokemonController(
    private val pokemonService: PokemonService,
) {
    @GetMapping("/api/pokemon")
    fun list(
        @AuthenticationPrincipal jwt: Jwt,
    ): List<PokemonDto> = pokemonService.list(userId(jwt))

    @GetMapping("/api/pokemon/{id}")
    fun get(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable id: UUID,
    ): PokemonDto = pokemonService.get(userId(jwt), id) ?: throw notFound(id)

    @PostMapping("/api/pokemon")
    @ResponseStatus(HttpStatus.CREATED)
    fun create(
        @AuthenticationPrincipal jwt: Jwt,
        @RequestBody input: CreateCaughtPokemon,
    ): PokemonDto = pokemonService.create(userId(jwt), input)

    @PatchMapping("/api/pokemon/{id}")
    fun update(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable id: UUID,
        @RequestBody patch: PatchCaughtPokemon,
    ): PokemonDto = pokemonService.update(userId(jwt), id, patch) ?: throw notFound(id)

    @DeleteMapping("/api/pokemon/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun delete(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable id: UUID,
    ) {
        if (!pokemonService.delete(userId(jwt), id)) throw notFound(id)
    }

    private fun userId(jwt: Jwt): String = requireNotNull(jwt.subject) { "authenticated request without a sub" }

    private fun notFound(id: UUID) = NotFoundException("pokemon-not-found", "No Pokémon with id '$id'")
}
