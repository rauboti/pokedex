package no.rauboti.pokedex.species

import no.rauboti.pokedex.catalog.sync.domain.NormalizedSpecies
import no.rauboti.pokedex.move.domain.RecommendedMoveIds
import no.rauboti.pokedex.species.domain.Species
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository
import java.sql.ResultSet
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneOffset

/**
 * Read access to the synced species catalog for search. Matches a case-insensitive name substring,
 * restricted to **registrable** species (mega/temporary battle forms are never returned), ordered
 * by dex number then form (base form before named forms), capped by the caller's limit.
 * `position(lower(:q) in lower(name))` is a true substring test — no LIKE wildcard semantics leak
 * from the query string.
 */
@Repository
class SpeciesRepository(
    private val jdbc: JdbcClient,
) {
    fun upsert(
        species: NormalizedSpecies,
        syncedAt: Instant,
    ) {
        jdbc
            .sql(
                """
                INSERT INTO species (id, dex_nr, name, form, base_atk, base_def, base_sta,
                                     type_1, type_2, registrable, image_url, shiny_image_url, rarity, synced_at)
                VALUES (:id, :dexNr, :name, :form, :atk, :def, :sta, :t1, :t2, :registrable,
                        :imageUrl, :shinyImageUrl, :rarity, :syncedAt)
                ON CONFLICT (id) DO UPDATE SET
                    dex_nr = excluded.dex_nr, name = excluded.name, form = excluded.form,
                    base_atk = excluded.base_atk, base_def = excluded.base_def, base_sta = excluded.base_sta,
                    type_1 = excluded.type_1, type_2 = excluded.type_2, registrable = excluded.registrable,
                    image_url = excluded.image_url, shiny_image_url = excluded.shiny_image_url,
                    rarity = excluded.rarity, synced_at = excluded.synced_at
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
            .param("imageUrl", species.imageUrl)
            .param("shinyImageUrl", species.shinyImageUrl)
            .param("rarity", species.rarity)
            .param("syncedAt", syncedAt.atUtc())
            .update()
    }

    fun count(): Long = jdbc.sql("SELECT count(*) FROM species").query(Long::class.java).single()

    fun search(
        query: String,
        limit: Int,
    ): List<Species> =
        jdbc
            .sql(
                """
                SELECT id, dex_nr, name, form, base_atk, base_def, base_sta, type_1, type_2,
                       image_url, shiny_image_url, rarity, synced_at
                FROM species
                WHERE registrable = true
                  AND position(lower(:q) in lower(name)) > 0
                ORDER BY dex_nr, form NULLS FIRST
                LIMIT :limit
                """.trimIndent(),
            ).param("q", query)
            .param("limit", limit)
            .query { rs, _ -> mapSpecies(rs) }
            .list()

    /**
     * A single species by its stable id, or null if absent. Unlike [search] this is not filtered by
     * `registrable` — it's a direct lookup (e.g. the derivation preview needs base stats for any id
     * the caller supplies; the registrable check on *save* lives in the write path).
     */
    fun findById(id: String): Species? =
        jdbc
            .sql(
                """
                SELECT id, dex_nr, name, form, base_atk, base_def, base_sta, type_1, type_2,
                       image_url, shiny_image_url, rarity, synced_at
                FROM species
                WHERE id = :id
                """.trimIndent(),
            ).param("id", id)
            .query { rs, _ -> mapSpecies(rs) }
            .optional()
            .orElse(null)

    /** Resolve several species by id in one query (empty in → empty out) — for collection assembly. */
    fun findByIds(ids: Collection<String>): List<Species> {
        if (ids.isEmpty()) return emptyList()
        return jdbc
            .sql(
                """
                SELECT id, dex_nr, name, form, base_atk, base_def, base_sta, type_1, type_2,
                       image_url, shiny_image_url, rarity, synced_at
                FROM species
                WHERE id IN (:ids)
                """.trimIndent(),
            ).param("ids", ids)
            .query { rs, _ -> mapSpecies(rs) }
            .list()
    }

    /**
     * The recommended-moveset ids stored on a species, or null if the species does not exist —
     * lets the moves endpoint tell 404 (no such species) from a species with no recommendation yet
     * (both ids null). The write path is [updateRecommendedMoves], run after each sync.
     */
    fun findRecommendedMoveIds(id: String): RecommendedMoveIds? =
        jdbc
            .sql(
                "SELECT recommended_fast_move_id, recommended_charged_move_id FROM species WHERE id = :id",
            ).param("id", id)
            .query { rs, _ ->
                RecommendedMoveIds(
                    rs.getString("recommended_fast_move_id"),
                    rs.getString("recommended_charged_move_id"),
                )
            }.optional()
            .orElse(null)

    /** Store (or clear, with nulls) a species' sync-computed recommended moveset. */
    fun updateRecommendedMoves(
        speciesId: String,
        fastMoveId: String?,
        chargedMoveId: String?,
    ) {
        jdbc
            .sql(
                """
                UPDATE species
                SET recommended_fast_move_id = :fast, recommended_charged_move_id = :charged
                WHERE id = :id
                """.trimIndent(),
            ).param("id", speciesId)
            .param("fast", fastMoveId)
            .param("charged", chargedMoveId)
            .update()
    }

    /** The registrable flag for a species (write invariant 0), or null if the id is unknown. */
    fun isRegistrable(id: String): Boolean? =
        jdbc
            .sql("SELECT registrable FROM species WHERE id = :id")
            .param("id", id)
            .query(Boolean::class.java)
            .optional()
            .orElse(null)

    /** The most recent sync time across the catalog, or null before the first sync. */
    fun lastSyncedAt(): Instant? =
        jdbc
            .sql("SELECT max(synced_at) AS ts FROM species")
            // max() over an empty table yields one row with a null value; `.single()` would reject
            // that null, so take the (possibly-null) single element via list().
            .query { rs, _ -> rs.getTimestamp("ts")?.toInstant() }
            .list()
            .firstOrNull()

    private fun Instant.atUtc(): OffsetDateTime = OffsetDateTime.ofInstant(this, ZoneOffset.UTC)

    private fun mapSpecies(rs: ResultSet): Species =
        Species(
            id = rs.getString("id"),
            dexNr = rs.getInt("dex_nr"),
            name = rs.getString("name"),
            form = rs.getString("form"),
            types = listOfNotNull(rs.getString("type_1"), rs.getString("type_2")),
            baseAtk = rs.getInt("base_atk"),
            baseDef = rs.getInt("base_def"),
            baseSta = rs.getInt("base_sta"),
            imageUrl = rs.getString("image_url"),
            shinyImageUrl = rs.getString("shiny_image_url"),
            rarity = rs.getString("rarity"),
            syncedAt = rs.getTimestamp("synced_at").toInstant(),
        )
}
