package no.rauboti.pokedex.stats

import tools.jackson.module.kotlin.jacksonObjectMapper

/**
 * The vendored power-up stardust cost per level, used only to label CP-collision candidates.
 * Covers power-up-from levels 1.0–49.5 — past the cap there is no cost, so [dust] returns null.
 */
object DustTable {
    private val byHalfStep: Map<Int, Int>

    /** Ascending: 1.0 … 49.5. */
    val levels: List<Double>

    init {
        val stream =
            requireNotNull(DustTable::class.java.getResourceAsStream("/reference/dust.json")) {
                "reference/dust.json missing from the classpath"
            }
        val root = stream.use { jacksonObjectMapper().readTree(it) }
        val map = sortedMapOf<Int, Int>()
        for (entry in root["bands"]) {
            map[key(entry["level"].asDouble())] = entry["dust"].asInt()
        }
        byHalfStep = map
        levels = map.keys.map { it / 2.0 }
    }

    fun dust(level: Double): Int? = byHalfStep[key(level)]

    private fun key(level: Double): Int = Math.round(level * 2).toInt()
}
