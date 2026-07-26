package no.rauboti.pokedex.species

import no.rauboti.pokedex.catalog.sync.domain.NormalizedSpecies
import no.rauboti.pokedex.species.domain.Species
import org.springframework.stereotype.Service
import java.time.Instant

@Service
class SpeciesService(
    private val repository: SpeciesRepository,
) {
    fun upsert(
        species: NormalizedSpecies,
        syncedAt: Instant,
    ) = repository.upsert(species, syncedAt)

    fun count() = repository.count()

    fun search(
        query: String,
        limit: Int,
    ): List<Species> = repository.search(query, limit)

    fun findById(id: String): Species? = repository.findById(id)

    fun findByIds(ids: Collection<String>): List<Species> = repository.findByIds(ids)

    fun isRegistrable(id: String) = repository.isRegistrable(id)

    fun lastSyncedAt() = repository.lastSyncedAt()
}
