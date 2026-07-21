package no.rauboti.pokedex.stats

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

/**
 * Level projections (research D7, FR-009): L40 and L50 always, plus a Best-Buddy (+1 from current
 * level) row when flagged. CP/HP verified against community calculators for a hundo Dragonite.
 */
class ProjectionsTest {
    private val dragonite = intArrayOf(263, 198, 209)

    private fun of(
        currentLevel: Double,
        bestBuddy: Boolean,
    ) = Projections.projectionsFor(
        dragonite[0],
        dragonite[1],
        dragonite[2],
        15,
        15,
        15,
        currentLevel,
        bestBuddy,
    )

    @Test
    fun `always projects L40 and L50, not Best Buddy when unflagged`() {
        val projections = of(currentLevel = 40.0, bestBuddy = false)
        assertThat(projections.map { it.label })
            .containsExactly(Projections.ProjectionLabel.L40, Projections.ProjectionLabel.L50)

        val l40 = projections.single { it.label == Projections.ProjectionLabel.L40 }
        assertThat(l40.level).isEqualTo(40.0)
        assertThat(l40.cp).isEqualTo(3792)
        assertThat(l40.hp).isEqualTo(177)

        val l50 = projections.single { it.label == Projections.ProjectionLabel.L50 }
        assertThat(l50.level).isEqualTo(50.0)
        assertThat(l50.cp).isEqualTo(4287)
        assertThat(l50.hp).isEqualTo(188)
    }

    @Test
    fun `adds a Best-Buddy row at current level plus one when flagged`() {
        val projections = of(currentLevel = 40.0, bestBuddy = true)
        assertThat(projections.map { it.label })
            .containsExactly(
                Projections.ProjectionLabel.L40,
                Projections.ProjectionLabel.L50,
                Projections.ProjectionLabel.BEST_BUDDY,
            )
        val bb = projections.single { it.label == Projections.ProjectionLabel.BEST_BUDDY }
        assertThat(bb.level).isEqualTo(41.0)
        assertThat(bb.cp).isEqualTo(3840)
        assertThat(bb.hp).isEqualTo(178)
    }

    @Test
    fun `omits the Best-Buddy row when the boosted level would exceed the table`() {
        // Current level 51 (already Best-Buddy max) → +1 = 51.5 is off the table; no BB row.
        val projections = of(currentLevel = 51.0, bestBuddy = true)
        assertThat(projections.map { it.label })
            .containsExactly(Projections.ProjectionLabel.L40, Projections.ProjectionLabel.L50)
    }
}
