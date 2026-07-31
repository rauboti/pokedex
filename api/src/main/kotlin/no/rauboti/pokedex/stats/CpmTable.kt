package no.rauboti.pokedex.stats

import tools.jackson.module.kotlin.jacksonObjectMapper

/**
 * The vendored CP-multiplier table (levels 1.0–51.0 in half-steps), loaded once from the classpath.
 * Keyed by doubled integer so half-steps never become floating-point map keys.
 */
object CpmTable {
    private val byHalfStep: Map<Int, Double>

    /** Ascending: 1.0, 1.5, … 51.0. */
    val levels: List<Double>

    init {
        val stream =
            requireNotNull(CpmTable::class.java.getResourceAsStream("/reference/cpm.json")) {
                "reference/cpm.json missing from the classpath"
            }
        val root = stream.use { jacksonObjectMapper().readTree(it) }
        val map = sortedMapOf<Int, Double>()
        for (entry in root["levels"]) {
            map[key(entry["level"].asDouble())] = entry["cpm"].asDouble()
        }
        byHalfStep = map
        levels = map.keys.map { it / 2.0 }
    }

    /** Throws if [level] is not a known half-step. */
    fun cpm(level: Double): Double =
        byHalfStep[key(level)]
            ?: throw IllegalArgumentException("No CP multiplier for level $level")

    private fun key(level: Double): Int = Math.round(level * 2).toInt()
}
