package no.rauboti.pokedex.gamedata

import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneOffset

/**
 * Catalog persistence for the sync module (data-model `species`/`move`/`species_move`). Upserts are
 * keyed by the stable source id; species/move rows are never deleted (a form vanishing from the
 * source keeps existing collection rows valid), while a species' pool is replaced wholesale per sync.
 * `recommended_*_move_id` is intentionally left out of the species upsert so a re-sync preserves the
 * moveset recommendation written by the ranker (T028).
 */
@Repository
class CatalogRepository(
    private val jdbc: JdbcClient,
) {
    fun upsertMove(
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

    fun upsertSpecies(
        species: NormalizedSpecies,
        syncedAt: Instant,
    ) {
        jdbc
            .sql(
                """
                INSERT INTO species (id, dex_nr, name, form, base_atk, base_def, base_sta,
                                     type_1, type_2, registrable, synced_at)
                VALUES (:id, :dexNr, :name, :form, :atk, :def, :sta, :t1, :t2, :registrable, :syncedAt)
                ON CONFLICT (id) DO UPDATE SET
                    dex_nr = excluded.dex_nr, name = excluded.name, form = excluded.form,
                    base_atk = excluded.base_atk, base_def = excluded.base_def, base_sta = excluded.base_sta,
                    type_1 = excluded.type_1, type_2 = excluded.type_2, registrable = excluded.registrable,
                    synced_at = excluded.synced_at
                """.trimIndent(),
            ).param("id", species.id)
            .param("dexNr", species.dexNr)
            .param("name", species.name)
            .param("form", species.form)
            .param("atk", species.baseAtk)
            .param("def", species.baseDef)
            .param("sta", species.baseSta)
            .param("t1", species.type1)
            .param("t2", species.type2)
            .param("registrable", species.registrable)
            .param("syncedAt", syncedAt.atUtc())
            .update()
    }

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

    fun speciesCount(): Long = jdbc.sql("select count(*) from species").query(Long::class.java).single()

    fun moveCount(): Long = jdbc.sql("select count(*) from move").query(Long::class.java).single()

    /** The most recent sync time across the catalog, or null before the first sync. */
    fun lastSyncedAt(): Instant? =
        jdbc
            .sql("SELECT max(synced_at) AS ts FROM species")
            // max() over an empty table yields one row with a null value; `.single()` would reject
            // that null, so take the (possibly-null) single element via list().
            .query { rs, _ -> rs.getTimestamp("ts")?.toInstant() }
            .list()
            .firstOrNull()

    /** The authenticated caller's own stale Pokémon count (FR-013); other users' rows are never counted. */
    fun stalePokemonCount(userId: String): Long =
        jdbc
            .sql("SELECT count(*) FROM caught_pokemon WHERE user_id = :uid AND stale = true")
            .param("uid", userId)
            .query(Long::class.java)
            .single()

    private fun Instant.atUtc(): OffsetDateTime = OffsetDateTime.ofInstant(this, ZoneOffset.UTC)
}
