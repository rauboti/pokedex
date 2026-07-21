package no.rauboti.pokedex.stats

import kotlin.math.floor
import kotlin.math.sqrt

/**
 * The Pokémon GO stat formulas (research D7) — pure functions over base stats, IVs, and a CP
 * multiplier. The single authoritative implementation; the web app does zero stat math. CP and HP
 * both floor and clamp to a minimum of 10 (the game's floors).
 */
object StatFormulas {
    private const val MIN = 10

    /** Effective attack/defense/stamina at a CPM: `(base + iv) × cpm` (unfloored). */
    data class EffectiveStats(
        val attack: Double,
        val defense: Double,
        val stamina: Double,
    )

    /** `CP = floor((atk+ivA) · √(def+ivD) · √(sta+ivS) · cpm² / 10)`, clamped to ≥ 10. */
    fun cp(
        baseAtk: Int,
        baseDef: Int,
        baseSta: Int,
        ivAtk: Int,
        ivDef: Int,
        ivSta: Int,
        cpm: Double,
    ): Int {
        val raw =
            (baseAtk + ivAtk) *
                sqrt((baseDef + ivDef).toDouble()) *
                sqrt((baseSta + ivSta).toDouble()) *
                cpm * cpm / 10.0
        return maxOf(MIN, floor(raw).toInt())
    }

    /** `HP = floor((sta+ivS) · cpm)`, clamped to ≥ 10. */
    fun hp(
        baseSta: Int,
        ivSta: Int,
        cpm: Double,
    ): Int = maxOf(MIN, floor((baseSta + ivSta) * cpm).toInt())

    fun effectiveStats(
        baseAtk: Int,
        baseDef: Int,
        baseSta: Int,
        ivAtk: Int,
        ivDef: Int,
        ivSta: Int,
        cpm: Double,
    ): EffectiveStats =
        EffectiveStats(
            attack = (baseAtk + ivAtk) * cpm,
            defense = (baseDef + ivDef) * cpm,
            stamina = (baseSta + ivSta) * cpm,
        )

    /** IV completeness as a percentage of the 45-point max, to one decimal (FR-008). */
    fun ivPercent(
        ivAtk: Int,
        ivDef: Int,
        ivSta: Int,
    ): Double = Math.round((ivAtk + ivDef + ivSta) / 45.0 * 100.0 * 10.0) / 10.0
}
