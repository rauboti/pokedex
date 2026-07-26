package no.rauboti.pokedex.caughtpokemon

import no.rauboti.pokedex.caughtpokemon.domain.CaughtBasePokemon
import no.rauboti.pokedex.caughtpokemon.domain.CaughtPokemon
import org.springframework.stereotype.Service
import java.util.UUID

@Service
class CaughtPokemonService(
    private val repository: CaughtPokemonRepository,
) {
    fun save(caughtBasePokemon: CaughtBasePokemon) = repository.save(caughtBasePokemon)

    fun findByUserId(userId: String) = repository.findByUserId(userId)

    fun findByUserIdAndId(
        id: UUID,
        userId: String,
    ) = repository.findByUserIdAndId(id, userId)

    fun findAll() = repository.findAll()

    fun update(caughtPokemon: CaughtPokemon) = repository.update(caughtPokemon)

    fun delete(
        id: UUID,
        userId: String,
    ) = repository.delete(id, userId)

    fun markAsStale(ids: List<UUID>) = repository.markAsStale(ids)

    fun countStaleByUserId(userId: String) = repository.countStaleByUserId(userId)
}
