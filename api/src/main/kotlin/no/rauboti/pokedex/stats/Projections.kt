package no.rauboti.pokedex.stats

/**
 * Level projections for the detail view (research D7, FR-009): the Pokémon's CP/HP/effective stats
 * at fixed levels 40 and 50 always, plus a Best-Buddy row at current level + 1 when the flag is set
 * (and that boosted level is still within the 1.0–51.0 table). Best Buddy never alters the stored
 * level — it is a projection only. Pure Kotlin.
 */
object Projections {
    enum class ProjectionLabel { L40, L50, BEST_BUDDY }

    data class Projection(
        val label: ProjectionLabel,
        val level: Double,
        val cp: Int,
        val hp: Int,
        val attack: Double,
        val defense: Double,
        val stamina: Double,
    )

    fun projectionsFor(
        baseAtk: Int,
        baseDef: Int,
        baseSta: Int,
        ivAtk: Int,
        ivDef: Int,
        ivSta: Int,
        currentLevel: Double,
        bestBuddy: Boolean,
    ): List<Projection> {
        val rows = mutableListOf<Projection>()
        rows += at(ProjectionLabel.L40, 40.0, baseAtk, baseDef, baseSta, ivAtk, ivDef, ivSta)
        rows += at(ProjectionLabel.L50, 50.0, baseAtk, baseDef, baseSta, ivAtk, ivDef, ivSta)
        val boosted = currentLevel + 1.0
        if (bestBuddy && boosted in CpmTable.levels) {
            rows += at(ProjectionLabel.BEST_BUDDY, boosted, baseAtk, baseDef, baseSta, ivAtk, ivDef, ivSta)
        }
        return rows
    }

    private fun at(
        label: ProjectionLabel,
        level: Double,
        baseAtk: Int,
        baseDef: Int,
        baseSta: Int,
        ivAtk: Int,
        ivDef: Int,
        ivSta: Int,
    ): Projection {
        val cpm = CpmTable.cpm(level)
        val eff = StatFormulas.effectiveStats(baseAtk, baseDef, baseSta, ivAtk, ivDef, ivSta, cpm)
        return Projection(
            label = label,
            level = level,
            cp = StatFormulas.cp(baseAtk, baseDef, baseSta, ivAtk, ivDef, ivSta, cpm),
            hp = StatFormulas.hp(baseSta, ivSta, cpm),
            attack = eff.attack,
            defense = eff.defense,
            stamina = eff.stamina,
        )
    }
}
