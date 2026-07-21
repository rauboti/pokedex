package no.rauboti.pokedex.stats

import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.within
import org.junit.jupiter.api.Test

/**
 * The Pokémon GO CP/HP/effective-stat formulas (research D7), verified against community
 * calculators (GO Hub / PvPoke). CP and HP both floor and clamp to a minimum of 10.
 */
class StatFormulasTest {
    private val cpm40 = CpmTable.cpm(40.0)
    private val cpm1 = CpmTable.cpm(1.0)

    @Test
    fun `CP matches the published max-CP for a hundo Dragonite at L40`() {
        // Dragonite base 263/198/209, 15/15/15 → 3792 CP at L40 (GO Hub max-CP table).
        assertThat(StatFormulas.cp(263, 198, 209, 15, 15, 15, cpm40)).isEqualTo(3792)
    }

    @Test
    fun `CP floors and clamps to a minimum of 10`() {
        // Magikarp base 29/85/85, 0/0/0 at L1 → raw CP ~2.2 → clamped to 10.
        assertThat(StatFormulas.cp(29, 85, 85, 0, 0, 0, cpm1)).isEqualTo(10)
    }

    @Test
    fun `HP floors the effective stamina`() {
        // Dragonite stamina 209 + 15 = 224, × CPM(40) 0.7903 = 177.03 → 177.
        assertThat(StatFormulas.hp(209, 15, cpm40)).isEqualTo(177)
    }

    @Test
    fun `HP clamps to a minimum of 10`() {
        // Magikarp stamina 85 × CPM(1) 0.094 = 7.99 → floored 7 → clamped to 10.
        assertThat(StatFormulas.hp(85, 0, cpm1)).isEqualTo(10)
    }

    @Test
    fun `effective stats are (base + iv) times CPM`() {
        val eff = StatFormulas.effectiveStats(263, 198, 209, 15, 15, 15, cpm40)
        assertThat(eff.attack).isCloseTo(219.7034, within(0.01))
        assertThat(eff.defense).isCloseTo(168.3339, within(0.01))
        assertThat(eff.stamina).isCloseTo(177.0272, within(0.01))
    }

    @Test
    fun `IV percent is the IV sum over 45, to one decimal`() {
        assertThat(StatFormulas.ivPercent(15, 15, 15)).isEqualTo(100.0)
        assertThat(StatFormulas.ivPercent(0, 0, 0)).isEqualTo(0.0)
        assertThat(StatFormulas.ivPercent(15, 14, 13)).isEqualTo(93.3) // 42/45 = 93.33 → 93.3
    }
}
