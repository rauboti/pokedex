package no.rauboti.pokedex.pokemon

import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository

/**
 * Read access to moves and species move-pools for the write path (US1 invariant 2) and DTO
 * assembly. [poolMoveIds] gives the set a species can legally know; [findByIds] resolves recorded
 * move ids to their display shape (with the fast/charged flag used for slot validation).
 */
@Repository
class MoveRepository(
    private val jdbc: JdbcClient,
) {
    /** The move ids in a species' pool (from `species_move`). */
    fun poolMoveIds(speciesId: String): Set<String> =
        jdbc
            .sql("SELECT move_id FROM species_move WHERE species_id = :sid")
            .param("sid", speciesId)
            .query(String::class.java)
            .list()
            .filterNotNull()
            .toSet()

    /** Resolve the given move ids to [MoveDto]s (empty in → empty out). */
    fun findByIds(ids: Collection<String>): List<MoveDto> {
        if (ids.isEmpty()) return emptyList()
        return jdbc
            .sql("SELECT id, name, type, is_fast FROM move WHERE id IN (:ids)")
            .param("ids", ids)
            .query { rs, _ ->
                MoveDto(
                    id = rs.getString("id"),
                    name = rs.getString("name"),
                    type = rs.getString("type"),
                    fast = rs.getBoolean("is_fast"),
                )
            }.list()
    }
}
