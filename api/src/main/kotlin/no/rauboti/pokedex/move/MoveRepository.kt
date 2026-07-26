package no.rauboti.pokedex.move

import no.rauboti.pokedex.catalog.sync.domain.NormalizedMove
import no.rauboti.pokedex.move.dto.MoveDto
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneOffset

/**
 * Access to moves and species move-pools for the write path and DTO assembly. [poolMoveIds]
 * gives the set a species can legally know; [findByIds] resolves recorded move ids to their
 * display shape (with the fast/charged flag used for slot validation).
 */
@Repository
class MoveRepository(
    private val jdbc: JdbcClient,
) {
    fun upsert(
        move: NormalizedMove,
        syncedAt: Instant,
    ) {
        jdbc
            .sql(
                """
                INSERT INTO move (id, name, type, is_fast, power, energy, duration_ms, synced_at)
                VALUES (:id, :name, :type, :isFast, :power, :energy, :durationMs, :syncedAt)
                ON CONFLICT (id) DO UPDATE SET
                    name = excluded.name, type = excluded.type, is_fast = excluded.is_fast,
                    power = excluded.power, energy = excluded.energy, duration_ms = excluded.duration_ms,
                    synced_at = excluded.synced_at
                """.trimIndent(),
            ).param("id", move.id)
            .param("name", move.name)
            .param("type", move.type)
            .param("isFast", move.isFast)
            .param("power", move.power)
            .param("energy", move.energy)
            .param("durationMs", move.durationMs)
            .param("syncedAt", syncedAt.atUtc())
            .update()
    }

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

    /** The move ids in a species' pool (from `species_move`). */
    fun poolMoveIds(speciesId: String): Set<String> =
        jdbc
            .sql("SELECT move_id FROM species_move WHERE species_id = :sid")
            .param("sid", speciesId)
            .query(String::class.java)
            .list()
            .filterNotNull()
            .toSet()

    fun count(): Long = jdbc.sql("SELECT count(*) FROM move").query(Long::class.java).single()

    private fun Instant.atUtc(): OffsetDateTime = OffsetDateTime.ofInstant(this, ZoneOffset.UTC)
}
