package no.rauboti.pokedex.stats

import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.assertj.core.api.Assertions.within
import org.junit.jupiter.api.Test

/**
 * Pins the vendored CPM + dust reference tables (research D6). The four CPM anchors are the
 * canonical published values (GAME_MASTER / GO Hub); the table is stored as the game's float32
 * values (levels 1.0–45.0 from pogoapi.net) extended to 51.0 at the XL/Best-Buddy step, so exact
 * anchors are asserted within a small tolerance. Pure — no Spring, no DB.
 */
class CpmTableTest {
    @Test
    fun `covers levels 1_0 to 51_0 in half-steps (101 entries)`() {
        assertThat(CpmTable.levels).hasSize(101)
        assertThat(CpmTable.levels.first()).isEqualTo(1.0)
        assertThat(CpmTable.levels.last()).isEqualTo(51.0)
        assertThat(CpmTable.levels).isSorted()
        // Every entry is a 0.5 step.
        CpmTable.levels.zipWithNext().forEach { (a, b) ->
            assertThat(b - a).isCloseTo(0.5, within(1e-9))
        }
    }

    @Test
    fun `pins the canonical CPM anchors`() {
        assertThat(CpmTable.cpm(1.0)).isCloseTo(0.094, within(1e-6))
        assertThat(CpmTable.cpm(40.0)).isCloseTo(0.7903, within(1e-6))
        assertThat(CpmTable.cpm(50.0)).isCloseTo(0.84029999, within(1e-6))
        assertThat(CpmTable.cpm(51.0)).isCloseTo(0.84529999, within(1e-6))
    }

    @Test
    fun `rejects a level outside the table`() {
        assertThatThrownBy { CpmTable.cpm(0.5) }.isInstanceOf(IllegalArgumentException::class.java)
        assertThatThrownBy { CpmTable.cpm(51.5) }.isInstanceOf(IllegalArgumentException::class.java)
    }

    @Test
    fun `dust bands are complete for every power-up level (1_0 to 49_5)`() {
        // 98 half-steps from 1.0 to 49.5 inclusive; level 50 has no power-up-from cost.
        assertThat(DustTable.levels).hasSize(98)
        assertThat(DustTable.levels.first()).isEqualTo(1.0)
        assertThat(DustTable.levels.last()).isEqualTo(49.5)
        assertThat(DustTable.dust(1.0)).isEqualTo(200)
        assertThat(DustTable.dust(50.0)).isNull() // no power-up beyond the cap
    }
}
