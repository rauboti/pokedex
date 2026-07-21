package no.rauboti.pokedex.species

import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository
import java.sql.ResultSet

/**
 * Read access to the synced species catalog for search (US1). Matches a case-insensitive name
 * substring, restricted to **registrable** species (mega/temporary battle forms are never returned —
 * clarification 2026-07-20), ordered by dex number then form (base form before named forms), capped
 * by the caller's limit. `position(lower(:q) in lower(name))` is a true substring test — no LIKE
 * wildcard semantics leak from the query string.
 */
@Repository
class SpeciesRepository(
    private val jdbc: JdbcClient,
) {
    fun search(
        query: String,
        limit: Int,
    ): List<Species> =
        jdbc
            .sql(
                """
                SELECT id, dex_nr, name, form, base_atk, base_def, base_sta, type_1, type_2,
                       image_url, shiny_image_url, synced_at
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
     * the caller supplies; the registrable check on *save* lives in the write path, T017).
     */
    fun findById(id: String): Species? =
        jdbc
            .sql(
                """
                SELECT id, dex_nr, name, form, base_atk, base_def, base_sta, type_1, type_2,
                       image_url, shiny_image_url, synced_at
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
                       image_url, shiny_image_url, synced_at
                FROM species
                WHERE id IN (:ids)
                """.trimIndent(),
            ).param("ids", ids)
            .query { rs, _ -> mapSpecies(rs) }
            .list()
    }

    /** The registrable flag for a species (write invariant 0), or null if the id is unknown. */
    fun registrable(id: String): Boolean? =
        jdbc
            .sql("SELECT registrable FROM species WHERE id = :id")
            .param("id", id)
            .query(Boolean::class.java)
            .optional()
            .orElse(null)

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
            syncedAt = rs.getTimestamp("synced_at").toInstant(),
        )
}
