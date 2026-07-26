package no.rauboti.pokedex.move

import no.rauboti.pokedex.catalog.sync.domain.NormalizedMove
import org.springframework.stereotype.Service
import java.time.Instant

@Service
class MoveService(
    private val repository: MoveRepository,
) {
    fun upsert(
        move: NormalizedMove,
        syncedAt: Instant,
    ) = repository.upsert(move, syncedAt)

    fun findByIds(ids: Collection<String>) = repository.findByIds(ids)

    fun poolMoveIds(speciesId: String) = repository.poolMoveIds(speciesId)

    fun count() = repository.count()
}
