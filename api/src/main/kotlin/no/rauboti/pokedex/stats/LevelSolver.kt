package no.rauboti.pokedex.stats

/**
 * The CP→level solver (research D7, FR-002/FR-003): given a species' base stats, a Pokémon's IVs,
 * and its observed CP, return **all** half-step levels (1.0–51.0) whose computed CP equals the
 * observed value. Almost always exactly one — CP is strictly non-decreasing in level for fixed IVs,
 * so multiple matches only occur on the CP=10 clamp plateau at the lowest levels (a genuine
 * collision the caller disambiguates, US1 scenario 4). An empty list means the (species, IVs, CP)
 * combination is impossible (SC-004). Pure Kotlin.
 */
object LevelSolver {
    fun solve(
        baseAtk: Int,
        baseDef: Int,
        baseSta: Int,
        ivAtk: Int,
        ivDef: Int,
        ivSta: Int,
        cp: Int,
    ): List<Double> =
        CpmTable.levels.filter { level ->
            StatFormulas.cp(baseAtk, baseDef, baseSta, ivAtk, ivDef, ivSta, CpmTable.cpm(level)) == cp
        }
}
