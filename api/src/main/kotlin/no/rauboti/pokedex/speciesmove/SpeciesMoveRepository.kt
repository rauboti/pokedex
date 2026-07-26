package no.rauboti.pokedex.speciesmove

import no.rauboti.pokedex.catalog.sync.domain.NormalizedPoolEntry
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository

@Repository
class SpeciesMoveRepository(
    private val jdbc: JdbcClient,
) {
    /** Replace a species' move pool in full (delete + insert); [entries] may be empty (clears it). */
    fun replacePool(
        speciesId: String,
        entries: List<NormalizedPoolEntry>,
    ) {
        jdbc.sql("DELETE FROM species_move WHERE species_id = :sid").param("sid", speciesId).update()
        for (e in entries) {
            jdbc
                .sql(
                    "INSERT INTO species_move (species_id, move_id, legacy) VALUES (:sid, :mid, :legacy)",
                ).param("sid", e.speciesId)
                .param("mid", e.moveId)
                .param("legacy", e.legacy)
                .update()
        }
    }
}
