package no.rauboti.pokedex.move

import no.rauboti.pokedex.move.domain.RankableMove
import no.rauboti.pokedex.move.domain.RecommendedMoveset
import kotlin.math.ceil

/**
 * The sync-time optimal-moveset heuristic. Pure and Spring-free — like `stats/`, it is exercised
 * directly by unit tests with no application context.
 *
 * The metric is **sustained cycle DPS**: you spam a fast move to build energy, then fire a charged
 * move, repeating. For each (fast, charged) pairing:
 * ```
 *   fastsPerCharge = ceil(energyCost / energyGain)
 *   cycleMs        = fastsPerCharge * fastDurationMs + chargedDurationMs
 *   cycleDamage    = fastsPerCharge * fastPower * STAB(fast) + chargedPower * STAB(charged)
 *   dps            = cycleDamage / (cycleMs / 1000)
 * ```
 * with the 1.2× STAB bonus when a move's type matches one of the species' types. The pairing with
 * the highest DPS wins. Legacy / Elite-TM moves are ranked exactly like any other pool move — the
 * canonical "best" answers (e.g. Swampert's Hydro Cannon) are legacy moves; the UI marks them as not
 * normally obtainable rather than hiding them from the ranking.
 *
 * NOTE (spec calibration): pure cycle DPS reliably reproduces the community-listed *charged* move
 * but not always the *fast* move — see research.md D8's amendment note and `MovesetRankerTest`. The
 * heuristic here is the one D8 specifies; the divergence is documented, not silently tuned away.
 */
object MovesetRanker {
    /** The STAB (same-type-attack-bonus) multiplier applied when a move's type matches the species. */
    const val STAB: Double = 1.2

    /**
     * The highest-cycle-DPS fast+charged pairing from [moves] for a species of the given [types]
     * (1–2 canonical type names), or null when the pool lacks a fast or a charged move. Ties keep the
     * first pairing encountered in iteration order (stable for a given pool ordering).
     */
    fun recommend(
        types: Collection<String>,
        moves: Collection<RankableMove>,
    ): RecommendedMoveset? {
        val stabTypes = types.mapTo(HashSet()) { it.trim().lowercase() }
        val fastMoves = moves.filter { it.fast }
        val chargedMoves = moves.filterNot { it.fast }
        if (fastMoves.isEmpty() || chargedMoves.isEmpty()) return null

        var best: RecommendedMoveset? = null
        var bestDps = Double.NEGATIVE_INFINITY
        for (fast in fastMoves) {
            for (charged in chargedMoves) {
                val dps = cycleDps(fast, charged, stabTypes) ?: continue
                if (dps > bestDps) {
                    bestDps = dps
                    best = RecommendedMoveset(fast.id, charged.id)
                }
            }
        }
        return best
    }

    /** Cycle DPS of one fast→charged pairing, or null if the pairing is degenerate (a fast move that
     *  generates no energy, or a charged move with no energy cost — neither occurs in valid feed data). */
    private fun cycleDps(
        fast: RankableMove,
        charged: RankableMove,
        stabTypes: Set<String>,
    ): Double? {
        val energyCost = -charged.energy // charged energy is stored negative (cost); fast is positive (gain)
        if (fast.energy <= 0.0 || energyCost <= 0.0) return null

        val fastsPerCharge = ceil(energyCost / fast.energy).toInt()
        val cycleMs = fastsPerCharge.toDouble() * fast.durationMs + charged.durationMs
        if (cycleMs <= 0.0) return null

        val cycleDamage =
            fastsPerCharge * fast.power * stab(fast.type, stabTypes) +
                charged.power * stab(charged.type, stabTypes)
        return cycleDamage / (cycleMs / 1000.0)
    }

    private fun stab(
        type: String,
        stabTypes: Set<String>,
    ): Double = if (type.trim().lowercase() in stabTypes) STAB else 1.0
}