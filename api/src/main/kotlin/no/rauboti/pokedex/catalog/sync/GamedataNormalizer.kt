package no.rauboti.pokedex.catalog.sync

import no.rauboti.pokedex.catalog.sync.domain.NormalizedCatalog
import no.rauboti.pokedex.catalog.sync.domain.NormalizedMove
import no.rauboti.pokedex.catalog.sync.domain.NormalizedPoolEntry
import no.rauboti.pokedex.catalog.sync.domain.NormalizedSpecies
import no.rauboti.pokedex.common.GamedataUnavailableException
import org.springframework.stereotype.Component
import tools.jackson.databind.JsonNode
import tools.jackson.module.kotlin.jacksonObjectMapper

/**
 * Normalizes the pokemon-go-api Pokédex feed into catalog rows — pure, unit-tested against committed
 * fixture JSON. Feed shape and the per-field skip rules are described in the api README ("Catalog sync").
 *
 * Deliberately defensive: a species or move missing a required field is skipped rather than fatal,
 * because the source carries occasional placeholder entries. Only an unparseable or non-array root
 * fails the whole feed.
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

    /** [dexNr] and [baseId] come from the owning top-level entry — forms and megas inherit both. */
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
                rarity = node.at("/pokemonClass").asTextOrNull()?.let(::canonicalRarity),
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

    /** `POKEMON_TYPE_GRASS` → `Grass` — language-independent, unlike the feed's `names` map. */
    private fun canonicalType(raw: String): String =
        raw
            .removePrefix("POKEMON_TYPE_")
            .lowercase()
            .replaceFirstChar { it.uppercase() }

    /** `POKEMON_CLASS_LEGENDARY` → `Legendary`, `POKEMON_CLASS_ULTRA_BEAST` → `Ultra Beast`; blank → null. */
    private fun canonicalRarity(raw: String): String? =
        raw
            .removePrefix("POKEMON_CLASS_")
            .takeIf { it.isNotBlank() }
            ?.split("_")
            ?.joinToString(" ") { it.lowercase().replaceFirstChar { c -> c.uppercase() } }

    /** `RATTATA_ALOLA` over base `RATTATA` → `Alola`. The base form itself has no label. */
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
