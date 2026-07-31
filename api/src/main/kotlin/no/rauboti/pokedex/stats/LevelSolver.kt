package no.rauboti.pokedex.stats

/**
 * Returns **every** half-step level whose computed CP equals the observed one — almost always exactly
 * one, since CP is non-decreasing in level; multiple matches occur only on the CP=10 clamp plateau,
 * a genuine collision the caller disambiguates. Empty means the combination is impossible.
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
