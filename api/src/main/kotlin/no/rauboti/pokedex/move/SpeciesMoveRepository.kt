package no.rauboti.pokedex.move

import no.rauboti.pokedex.catalog.sync.domain.NormalizedPoolEntry
import no.rauboti.pokedex.move.dto.MoveDto
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

    /** Ordered fast-then-charged, alphabetical within each — stable output for the moves endpoint. */
    fun findPoolMoves(speciesId: String): List<MoveDto> =
        jdbc
            .sql(
                """
                SELECT m.id, m.name, m.type, m.is_fast, sm.legacy
                FROM species_move sm
                JOIN move m ON m.id = sm.move_id
                WHERE sm.species_id = :sid
                ORDER BY m.is_fast DESC, m.name
                """.trimIndent(),
            ).param("sid", speciesId)
            .query { rs, _ ->
                MoveDto(
                    id = rs.getString("id"),
                    name = rs.getString("name"),
                    type = rs.getString("type"),
                    fast = rs.getBoolean("is_fast"),
                    legacy = rs.getBoolean("legacy"),
                )
            }.list()
}
