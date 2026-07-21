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
                SELECT id, dex_nr, name, form, base_atk, base_def, base_sta, type_1, type_2, synced_at
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
            syncedAt = rs.getTimestamp("synced_at").toInstant(),
        )
}
