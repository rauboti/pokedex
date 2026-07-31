package no.rauboti.pokedex.move

import no.rauboti.pokedex.move.domain.RankableMove
import no.rauboti.pokedex.move.domain.RecommendedMoveset
import kotlin.math.ceil

/**
 * The sync-time optimal-moveset heuristic: highest sustained cycle DPS, with STAB. Pure and
 * Spring-free. The formula and its inputs are written out in the api README ("Moveset ranking").
 *
 * NOTE (spec calibration): pure cycle DPS reliably reproduces the community-listed *charged* move but
 * not always the *fast* move — see research.md D8's amendment note and `MovesetRankerTest`. This is
 * the heuristic D8 specifies; the divergence is documented, not silently tuned away.
 */
object MovesetRanker {
    const val STAB: Double = 1.2

    /**
     * Null when the pool lacks a fast or a charged move. Ties keep the first pairing in iteration
     * order (stable for a given pool ordering).
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

    /** Null for a degenerate pairing (no energy gain or no energy cost) — absent from valid feed data. */
    private fun cycleDps(
        fast: RankableMove,
        charged: RankableMove,
        stabTypes: Set<String>,
    ): Double? {
        val energyCost = -charged.energy // charged energy is stored negative (cost), fast positive (gain)
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
