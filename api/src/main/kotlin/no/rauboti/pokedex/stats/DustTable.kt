package no.rauboti.pokedex.stats

import tools.jackson.module.kotlin.jacksonObjectMapper

/**
 * The vendored power-up stardust cost per level (research D6), loaded from the classpath resource
 * `reference/dust.json`. Used only to label CP-collision candidates by dust cost (US1 scenario 4).
 * Covers the power-up-from levels 1.0–49.5; there is no cost beyond the level cap, so [dust] returns
 * null for level 50 and above. Pure Kotlin — no Spring.
 */
object DustTable {
    private val byHalfStep: Map<Int, Int>

    /** All levels that have a power-up-from cost, ascending (1.0 … 49.5). */
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

    /** The stardust cost to power up from [level], or null when there is none (level cap reached). */
    fun dust(level: Double): Int? = byHalfStep[key(level)]

    private fun key(level: Double): Int = Math.round(level * 2).toInt()
}
