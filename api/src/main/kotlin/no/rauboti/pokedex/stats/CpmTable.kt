package no.rauboti.pokedex.stats

import tools.jackson.module.kotlin.jacksonObjectMapper

/**
 * The vendored CP-multiplier table (research D6): levels 1.0–51.0 in half-steps, loaded once from
 * the classpath resource `reference/cpm.json`. Pure Kotlin — no Spring — so the stats module is
 * unit-testable in isolation (research D7). Levels are keyed by their doubled integer (half-steps →
 * whole numbers) to avoid floating-point map-key pitfalls.
 */
object CpmTable {
    private val byHalfStep: Map<Int, Double>

    /** All table levels, ascending (1.0, 1.5, … 51.0). */
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

    /** The CP multiplier at [level]. Throws if [level] is not a known half-step in 1.0–51.0. */
    fun cpm(level: Double): Double =
        byHalfStep[key(level)]
            ?: throw IllegalArgumentException("No CP multiplier for level $level")

    private fun key(level: Double): Int = Math.round(level * 2).toInt()
}
