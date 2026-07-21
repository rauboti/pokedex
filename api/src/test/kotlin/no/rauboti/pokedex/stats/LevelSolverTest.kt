package no.rauboti.pokedex.stats

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

/**
 * **The SC-002 gate.** The CP→level solver returns *all* half-step levels (1.0–51.0) whose computed
 * CP equals the observed CP, respecting the CP≥10 clamp. The sample below is ten real Pokémon whose
 * L40 15/15/15 CP is the published max-CP from GO Hub's CP tables (cross-checked against PvPoke);
 * six are canonical, famous values (Dragonite 3792, Tyranitar 3834, Gyarados 3391, Snorlax 3225,
 * Mewtwo 4178, Slaking 4431). Base stats are the synced game values (pokemon-go-api.github.io).
 *
 * Sources (re-verifiable): https://db.pokemongohub.net (per-species max-CP + HP), PvPoke rankings.
 */
class LevelSolverTest {
    private val cpm40 = CpmTable.cpm(40.0)

    /** A verified anchor: published L40 15/15/15 CP + HP for a real species (GO Hub / PvPoke). */
    private data class Anchor(
        val name: String,
        val atk: Int,
        val def: Int,
        val sta: Int,
        val cp: Int,
        val hp: Int,
    )

    private val sample =
        listOf(
            Anchor("Dragonite", 263, 198, 209, 3792, 177),
            Anchor("Machamp", 234, 159, 207, 3056, 175),
            Anchor("Tyranitar", 251, 207, 225, 3834, 189),
            Anchor("Gyarados", 237, 186, 216, 3391, 182),
            Anchor("Snorlax", 190, 169, 330, 3225, 272),
            Anchor("Blissey", 129, 169, 496, 2757, 403),
            Anchor("Rayquaza", 284, 170, 213, 3835, 180),
            Anchor("Mewtwo", 300, 182, 214, 4178, 180),
            Anchor("Vaporeon", 205, 161, 277, 3114, 230),
            Anchor("Slaking", 290, 166, 284, 4431, 236),
        )

    @Test
    fun `resolves each sample Pokemon's max CP to exactly level 40 with the published HP`() {
        for (a in sample) {
            // The formula reproduces the published CP/HP (SC-002 zero-discrepancy)...
            assertThat(StatFormulas.cp(a.atk, a.def, a.sta, 15, 15, 15, cpm40)).describedAs("%s CP", a.name).isEqualTo(a.cp)
            assertThat(StatFormulas.hp(a.sta, 15, cpm40)).describedAs("%s HP", a.name).isEqualTo(a.hp)
            // ...and the solver inverts it back to a single level 40.
            assertThat(LevelSolver.solve(a.atk, a.def, a.sta, 15, 15, 15, a.cp))
                .describedAs("%s solve", a.name)
                .containsExactly(40.0)
        }
    }

    @Test
    fun `a CP collision returns every matching level (the CP-10 clamp plateau)`() {
        // Magikarp 29/85/85, 0/0/0: levels 1.0–2.5 all floor+clamp to CP 10. The solver surfaces all
        // four so the UI can disambiguate (US1 scenario 4). (Within this clamp the dust cost ties at
        // 200 — see the task note; dust separates candidates only across bands.)
        assertThat(LevelSolver.solve(29, 85, 85, 0, 0, 0, 10)).containsExactly(1.0, 1.5, 2.0, 2.5)
    }

    @Test
    fun `an impossible combination yields no candidates (SC-004)`() {
        // No half-step level gives Mewtwo 15/15/15 a CP of 3105 (it falls in a gap between levels).
        assertThat(LevelSolver.solve(300, 182, 214, 15, 15, 15, 3105)).isEmpty()
    }

    @Test
    fun `a Best-Buddy boosted CP resolves to base level plus one`() {
        // A Dragonite powered to L40 then Best-Buddied reads its CP at effective L41 (3840). Entering
        // that boosted CP resolves to level 41 — within the 1.0–51.0 range (spec edge case, analyze C1).
        assertThat(LevelSolver.solve(263, 198, 209, 15, 15, 15, 3840)).containsExactly(41.0)
    }
}
