package no.rauboti.pokedex.gamedata

import no.rauboti.pokedex.common.GamedataUnavailableException
import org.springframework.stereotype.Component
import tools.jackson.databind.JsonNode
import tools.jackson.module.kotlin.jacksonObjectMapper

/**
 * Normalizes the pokemon-go-api.github.io Pokédex feed into catalog rows (research D5; feed shape and
 * source URLs documented in the research.md D5 addendum). Pure — no Spring context needed to run it,
 * no DB — so it is unit-tested directly against committed fixture JSON.
 *
 * The feed is a JSON array of species objects; move data is embedded per species under four
 * collections (`quickMoves`/`cinematicMoves` and their `elite*` legacy counterparts). The walk is
 * deliberately defensive: a species or move missing a required field is **skipped, not fatal**
 * (the source occasionally carries placeholder/partial entries); a root that is not a JSON array or
 * is unparseable is a whole-feed failure → [GamedataUnavailableException] (→ 502). Empty elite
 * collections serialize as `[]` (not `{}`); any non-object collection is treated as empty.
 */
@Component
class GamedataNormalizer {
    private val mapper = jacksonObjectMapper()

    fun normalize(feedJson: String): NormalizedCatalog {
        val root =
            try {
                mapper.readTree(feedJson)
            } catch (e: Exception) {
                throw GamedataUnavailableException("gamedata-unavailable", "Game-data feed is not valid JSON", e)
            }
        if (root == null || !root.isArray) {
            throw GamedataUnavailableException("gamedata-unavailable", "Game-data feed root is not an array")
        }

        val species = mutableListOf<NormalizedSpecies>()
        val moves = linkedMapOf<String, NormalizedMove>() // dedup by id, insertion-ordered
        val pool = mutableListOf<NormalizedPoolEntry>()

        for (entry in root) {
            val dexNr = entry["dexNr"]?.asInt() ?: continue
            val baseId = entry["id"]?.asString() ?: continue

            // Base form (registrable), then regional forms (registrable), then megas (not registrable).
            parseEntry(entry, dexNr, baseId, registrable = true, species, moves, pool)
            entry["regionForms"]?.takeIf { it.isArray }?.forEach { form ->
                parseEntry(form, dexNr, baseId, registrable = true, species, moves, pool)
            }
            entry["megaEvolutions"]?.takeIf { it.isObject }?.forEach { mega ->
                parseEntry(mega, dexNr, baseId, registrable = false, species, moves, pool)
            }
        }
        return NormalizedCatalog(species, moves.values.toList(), pool)
    }

    /**
     * Parse one species/form/mega node into a species row (+ its embedded move pool). Skips the node
     * entirely on any missing required field; skips an individual malformed move without dropping the
     * species. [dexNr] and [baseId] come from the owning top-level entry (forms/megas inherit the dex
     * number and derive their form label from the id suffix).
     */
    private fun parseEntry(
        node: JsonNode,
        dexNr: Int,
        baseId: String,
        registrable: Boolean,
        species: MutableList<NormalizedSpecies>,
        moves: MutableMap<String, NormalizedMove>,
        pool: MutableList<NormalizedPoolEntry>,
    ) {
        val id = node["id"]?.asString() ?: return
        val name = node.at("/names/English").asTextOrNull() ?: return
        val stats = node["stats"] ?: return
        val atk = stats["attack"]?.asIntOrNull() ?: return
        val def = stats["defense"]?.asIntOrNull() ?: return
        val sta = stats["stamina"]?.asIntOrNull() ?: return
        val type1 = node.at("/primaryType/type").asTextOrNull()?.let(::canonicalType) ?: return
        val type2 = node.at("/secondaryType/type").asTextOrNull()?.let(::canonicalType)

        species.add(
            NormalizedSpecies(
                id = id,
                dexNr = dexNr,
                name = name,
                form = formLabel(id, baseId),
                baseAtk = atk,
                baseDef = def,
                baseSta = sta,
                type1 = type1,
                type2 = type2,
                registrable = registrable,
                imageUrl = node.at("/assets/image").asTextOrNull(),
                shinyImageUrl = node.at("/assets/shinyImage").asTextOrNull(),
            ),
        )

        parseMoves(node["quickMoves"], isFast = true, legacy = false, id, moves, pool)
        parseMoves(node["cinematicMoves"], isFast = false, legacy = false, id, moves, pool)
        parseMoves(node["eliteQuickMoves"], isFast = true, legacy = true, id, moves, pool)
        parseMoves(node["eliteCinematicMoves"], isFast = false, legacy = true, id, moves, pool)
    }

    private fun parseMoves(
        collection: JsonNode?,
        isFast: Boolean,
        legacy: Boolean,
        speciesId: String,
        moves: MutableMap<String, NormalizedMove>,
        pool: MutableList<NormalizedPoolEntry>,
    ) {
        // Empty elite collections serialize as `[]`; only objects carry entries.
        if (collection == null || !collection.isObject) return
        for (m in collection) {
            val id = m["id"]?.asString() ?: continue
            val name = m.at("/names/English").asTextOrNull() ?: continue
            val type = m.at("/type/type").asTextOrNull()?.let(::canonicalType) ?: continue
            val power = m["power"]?.asDoubleOrNull() ?: continue
            val energy = m["energy"]?.asDoubleOrNull() ?: continue
            val durationMs = m["durationMs"]?.asIntOrNull() ?: continue

            moves.putIfAbsent(id, NormalizedMove(id, name, type, isFast, power, energy, durationMs))
            pool.add(NormalizedPoolEntry(speciesId, id, legacy))
        }
    }

    /** `POKEMON_TYPE_GRASS` → `Grass` — language-independent (no reliance on the `names` map). */
    private fun canonicalType(raw: String): String =
        raw
            .removePrefix("POKEMON_TYPE_")
            .lowercase()
            .replaceFirstChar { it.uppercase() }

    /**
     * The human-readable form label from the id suffix relative to the base: `RATTATA_ALOLA` vs base
     * `RATTATA` → `Alola`; `VENUSAUR_MEGA` → `Mega`. The base form (id == baseId) has no label (null).
     */
    private fun formLabel(
        id: String,
        baseId: String,
    ): String? {
        if (id == baseId) return null
        val suffix = id.removePrefix("${baseId}_").ifBlank { return null }
        return suffix
            .split("_")
            .joinToString(" ") { part -> part.lowercase().replaceFirstChar { it.uppercase() } }
    }

    private fun JsonNode.asTextOrNull(): String? = if (isMissingNode || isNull) null else asString()

    private fun JsonNode.asIntOrNull(): Int? = if (isNull || !isNumber) null else asInt()

    private fun JsonNode.asDoubleOrNull(): Double? = if (isNull || !isNumber) null else asDouble()
}
