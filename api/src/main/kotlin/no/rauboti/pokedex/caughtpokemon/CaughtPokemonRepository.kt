package no.rauboti.pokedex.caughtpokemon

import no.rauboti.pokedex.caughtpokemon.domain.CaughtBasePokemon
import no.rauboti.pokedex.caughtpokemon.domain.CaughtPokemon
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository
import java.sql.ResultSet
import java.util.UUID

/**
 * Persistence for `caught_pokemon`. Every query is scoped by `user_id`, so a wrong-owner
 * find/update/delete is simply a no-op that the caller reports as 404 (FR-014). [findAll] and
 * [markAsStale] are the deliberate cross-user exceptions, for the post-sync rescan only.
 */
@Repository
class CaughtPokemonRepository(
    private val jdbc: JdbcClient,
) {
    fun save(caughtBasePokemon: CaughtBasePokemon): CaughtPokemon =
        jdbc
            .sql(
                """
                INSERT INTO caught_pokemon
                    (user_id, species_id, iv_atk, iv_def, iv_sta, cp, level, stale,
                     shiny, shadow, lucky, purified, best_buddy,
                     fast_move_id, charged_move_1_id, charged_move_2_id, caught_at)
                VALUES
                    (:userId, :speciesId, :ivAtk, :ivDef, :ivSta, :cp, :level, :stale,
                     :shiny, :shadow, :lucky, :purified, :bestBuddy,
                     :fastMoveId, :charged1, :charged2, :caughtAt)
                RETURNING $COLUMNS
                """.trimIndent(),
            ).param("userId", caughtBasePokemon.userId)
            .param("speciesId", caughtBasePokemon.speciesId)
            .param("ivAtk", caughtBasePokemon.ivAtk)
            .param("ivDef", caughtBasePokemon.ivDef)
            .param("ivSta", caughtBasePokemon.ivSta)
            .param("cp", caughtBasePokemon.cp)
            .param("level", caughtBasePokemon.level)
            .param("stale", caughtBasePokemon.stale)
            .param("shiny", caughtBasePokemon.shiny)
            .param("shadow", caughtBasePokemon.shadow)
            .param("lucky", caughtBasePokemon.lucky)
            .param("purified", caughtBasePokemon.purified)
            .param("bestBuddy", caughtBasePokemon.bestBuddy)
            .param("fastMoveId", caughtBasePokemon.fastMoveId)
            .param("charged1", caughtBasePokemon.charged1MoveId)
            .param("charged2", caughtBasePokemon.charged2MoveId)
            .param("caughtAt", caughtBasePokemon.caughtAt)
            .query { rs, _ -> map(rs) }
            .single()

    fun findByUserId(userId: String): List<CaughtPokemon> =
        jdbc
            .sql("SELECT $COLUMNS FROM caught_pokemon WHERE user_id = :uid ORDER BY created_at")
            .param("uid", userId)
            .query { rs, _ -> map(rs) }
            .list()

    fun findByUserIdAndId(
        id: UUID,
        userId: String,
    ): CaughtPokemon? =
        jdbc
            .sql("SELECT $COLUMNS FROM caught_pokemon WHERE id = :id AND user_id = :uid")
            .param("id", id)
            .param("uid", userId)
            .query { rs, _ -> map(rs) }
            .optional()
            .orElse(null)

    /** Null when the id isn't owned by the caller — wrong owner and unknown id are indistinguishable. */
    fun update(pokemon: CaughtPokemon): CaughtPokemon? =
        jdbc
            .sql(
                """
                UPDATE caught_pokemon SET
                    species_id = :speciesId, iv_atk = :ivAtk, iv_def = :ivDef, iv_sta = :ivSta,
                    cp = :cp, level = :level, stale = :stale,
                    shiny = :shiny, shadow = :shadow, lucky = :lucky, purified = :purified, best_buddy = :bestBuddy,
                    fast_move_id = :fastMoveId, charged_move_1_id = :charged1, charged_move_2_id = :charged2,
                    caught_at = :caughtAt, updated_at = now()
                WHERE id = :id AND user_id = :uid
                RETURNING $COLUMNS
                """.trimIndent(),
            ).param("id", pokemon.id)
            .param("uid", pokemon.userId)
            .param("speciesId", pokemon.speciesId)
            .param("ivAtk", pokemon.ivAtk)
            .param("ivDef", pokemon.ivDef)
            .param("ivSta", pokemon.ivSta)
            .param("cp", pokemon.cp)
            .param("level", pokemon.level)
            .param("stale", pokemon.stale)
            .param("shiny", pokemon.shiny)
            .param("shadow", pokemon.shadow)
            .param("lucky", pokemon.lucky)
            .param("purified", pokemon.purified)
            .param("bestBuddy", pokemon.bestBuddy)
            .param("fastMoveId", pokemon.fastMoveId)
            .param("charged1", pokemon.charged1MoveId)
            .param("charged2", pokemon.charged2MoveId)
            .param("caughtAt", pokemon.caughtAt)
            .query { rs, _ -> map(rs) }
            .optional()
            .orElse(null)

    fun delete(
        id: UUID,
        userId: String,
    ): Boolean =
        jdbc
            .sql("DELETE FROM caught_pokemon WHERE id = :id AND user_id = :uid")
            .param("id", id)
            .param("uid", userId)
            .update() > 0

    /** Cross-user by design — the post-sync rescan re-derives the whole table. */
    fun findAll(): List<CaughtPokemon> = jdbc.sql("SELECT $COLUMNS FROM caught_pokemon").query { rs, _ -> map(rs) }.list()

    /** Cross-user by design, see [findAll]. */
    fun markAsStale(ids: List<UUID>) {
        if (ids.isEmpty()) return
        jdbc
            .sql("UPDATE caught_pokemon SET stale = true, updated_at = now() WHERE id IN (:ids)")
            .param("ids", ids)
            .update()
    }

    fun countStaleByUserId(userId: String): Long =
        jdbc
            .sql("SELECT count(*) FROM caught_pokemon WHERE user_id = :uid AND stale = true")
            .param("uid", userId)
            .query(Long::class.java)
            .single()

    private fun map(rs: ResultSet): CaughtPokemon =
        CaughtPokemon(
            id = UUID.fromString(rs.getString("id")),
            userId = rs.getString("user_id"),
            speciesId = rs.getString("species_id"),
            ivAtk = rs.getInt("iv_atk"),
            ivDef = rs.getInt("iv_def"),
            ivSta = rs.getInt("iv_sta"),
            cp = rs.getInt("cp"),
            level = rs.getDouble("level"),
            stale = rs.getBoolean("stale"),
            shiny = rs.getBoolean("shiny"),
            shadow = rs.getBoolean("shadow"),
            lucky = rs.getBoolean("lucky"),
            purified = rs.getBoolean("purified"),
            bestBuddy = rs.getBoolean("best_buddy"),
            fastMoveId = rs.getString("fast_move_id"),
            charged1MoveId = rs.getString("charged_move_1_id"),
            charged2MoveId = rs.getString("charged_move_2_id"),
            caughtAt = rs.getDate("caught_at")?.toLocalDate(),
            createdAt = rs.getTimestamp("created_at").toInstant(),
            updatedAt = rs.getTimestamp("updated_at").toInstant(),
        )

    private companion object {
        const val COLUMNS =
            "id, user_id, species_id, iv_atk, iv_def, iv_sta, cp, level, stale, " +
                "shiny, shadow, lucky, purified, best_buddy, " +
                "fast_move_id, charged_move_1_id, charged_move_2_id, caught_at, created_at, updated_at"
    }
}
