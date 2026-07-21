package no.rauboti.pokedex.pokemon

import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository
import java.sql.ResultSet
import java.util.UUID

/**
 * Persistence for the player-owned `caught_pokemon` table (US1). Every read is scoped by `user_id`
 * (FR-014) — a row is invisible to any other user, so a wrong-owner find/update/delete is a no-op
 * (the caller surfaces 404, indistinguishable from "unknown id"). `listAll` + `markStale` are the
 * cross-user hooks the post-sync staleness rescan uses (T018); all other reads stay user-scoped.
 */
@Repository
class CaughtPokemonRepository(
    private val jdbc: JdbcClient,
) {
    fun insert(new: NewCaughtPokemon): CaughtPokemon =
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
            ).param("userId", new.userId)
            .param("speciesId", new.speciesId)
            .param("ivAtk", new.ivAtk)
            .param("ivDef", new.ivDef)
            .param("ivSta", new.ivSta)
            .param("cp", new.cp)
            .param("level", new.level)
            .param("stale", new.stale)
            .param("shiny", new.shiny)
            .param("shadow", new.shadow)
            .param("lucky", new.lucky)
            .param("purified", new.purified)
            .param("bestBuddy", new.bestBuddy)
            .param("fastMoveId", new.fastMoveId)
            .param("charged1", new.charged1MoveId)
            .param("charged2", new.charged2MoveId)
            .param("caughtAt", new.caughtAt)
            .query { rs, _ -> map(rs) }
            .single()

    fun listByUser(userId: String): List<CaughtPokemon> =
        jdbc
            .sql("SELECT $COLUMNS FROM caught_pokemon WHERE user_id = :uid ORDER BY created_at")
            .param("uid", userId)
            .query { rs, _ -> map(rs) }
            .list()

    fun findByIdAndUser(
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

    /** Update the mutable fields of the caller's own row; returns the updated row, or null if the id
     *  isn't owned by [CaughtPokemon.userId] (wrong owner / unknown id). */
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

    /** Every user's rows — the post-sync rescan (T018) re-derives across the whole table. */
    fun listAll(): List<CaughtPokemon> = jdbc.sql("SELECT $COLUMNS FROM caught_pokemon").query { rs, _ -> map(rs) }.list()

    /** Flag the given rows stale (T018); a no-op on an empty id list. */
    fun markStale(ids: List<UUID>) {
        if (ids.isEmpty()) return
        jdbc
            .sql("UPDATE caught_pokemon SET stale = true, updated_at = now() WHERE id IN (:ids)")
            .param("ids", ids)
            .update()
    }

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
