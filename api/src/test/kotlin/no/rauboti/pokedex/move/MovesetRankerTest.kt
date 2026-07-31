package no.rauboti.pokedex.move

import no.rauboti.pokedex.move.domain.RankableMove
import no.rauboti.pokedex.move.domain.RecommendedMoveset
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test

/**
 * The SC-007 gate: the sync-time moveset ranker (research D8) reproduces community-listed best
 * movesets for well-known species, using pure cycle DPS over real move stats.
 *
 * ## Sources
 * Move power/energy/durationMs below are the **gym/raid (PvE)** values from the project's own feed
 * source, pokemon-go-api.github.io (`/api/pokedex/id/{dexNr}.json`) — the same data a live sync
 * ingests. Community "best moveset" claims are the long-standing consensus picks (GamePress
 * "best movesets" / PvPoke PvE). Energy convention matches the feed: fast moves carry positive
 * energy (generated), charged moves negative energy (cost).
 *
 * ## What is asserted (spec calibration — see research.md D8 amendment)
 * Pure cycle DPS reliably reproduces the community **charged** move for every species below; it also
 * reproduces the full pair for species whose fast slot is unambiguous (Rampardos, Electivire). Where
 * pure cycle DPS diverges from community on the *fast* move (Swampert wants Mud Shot but DPS favours
 * Water Gun; Metagross wants Bullet Punch but DPS favours Fury Cutter), we anchor on the charged move
 * — the meaningful "does it have the signature move" signal — rather than tune the heuristic to the
 * test. The divergence is a flagged D8 calibration item.
 */
class MovesetRankerTest {
    private fun fast(
        id: String,
        type: String,
        power: Double,
        energy: Double,
        durationMs: Int,
    ) = RankableMove(id, type, fast = true, power = power, energy = energy, durationMs = durationMs)

    private fun charged(
        id: String,
        type: String,
        power: Double,
        energy: Double,
        durationMs: Int,
    ) = RankableMove(id, type, fast = false, power = power, energy = energy, durationMs = durationMs)

    // --- Full-pair matches (cycle DPS reproduces the community moveset exactly) --------------------

    @Test
    fun `Rampardos (Rock) - Smack Down + Rock Slide`() {
        val recommended =
            MovesetRanker.recommend(
                listOf("Rock"),
                listOf(
                    fast("ZEN_HEADBUTT_FAST", "Psychic", 11.0, 9.0, 1000),
                    fast("SMACK_DOWN_FAST", "Rock", 13.0, 7.0, 1000),
                    charged("ROCK_SLIDE", "Rock", 75.0, -50.0, 2500),
                    charged("OUTRAGE", "Dragon", 110.0, -50.0, 4000),
                    charged("FLAMETHROWER", "Fire", 65.0, -50.0, 2000),
                ),
            )
        assertThat(recommended).isEqualTo(RecommendedMoveset("SMACK_DOWN_FAST", "ROCK_SLIDE"))
    }

    @Test
    fun `Electivire (Electric) - Thunder Shock + Wild Charge`() {
        val recommended =
            MovesetRanker.recommend(
                listOf("Electric"),
                listOf(
                    fast("THUNDER_SHOCK_FAST", "Electric", 4.0, 7.0, 500),
                    fast("LOW_KICK_FAST", "Fighting", 5.0, 5.0, 500),
                    charged("THUNDER_PUNCH", "Electric", 50.0, -33.0, 2000),
                    charged("WILD_CHARGE", "Electric", 90.0, -50.0, 2500),
                    charged("THUNDER", "Electric", 100.0, -100.0, 2500),
                    charged("ICE_PUNCH", "Ice", 50.0, -33.0, 2000),
                    charged("FLAMETHROWER", "Fire", 65.0, -50.0, 2000), // legacy
                ),
            )
        assertThat(recommended).isEqualTo(RecommendedMoveset("THUNDER_SHOCK_FAST", "WILD_CHARGE"))
    }

    // --- Charged-move-anchored matches (the signature charged move, incl. legacy) ------------------

    @Test
    fun `Swampert (Water Ground) - charged move is Hydro Cannon (legacy)`() {
        val recommended =
            MovesetRanker.recommend(
                listOf("Water", "Ground"),
                listOf(
                    fast("MUD_SHOT_FAST", "Ground", 4.0, 6.0, 500),
                    fast("WATER_GUN_FAST", "Water", 5.0, 5.0, 500),
                    charged("EARTHQUAKE", "Ground", 140.0, -100.0, 3500),
                    charged("SLUDGE_WAVE", "Poison", 105.0, -100.0, 3000),
                    charged("SURF", "Water", 60.0, -50.0, 1500),
                    charged("MUDDY_WATER", "Water", 45.0, -33.0, 2000),
                    charged("SLUDGE", "Poison", 50.0, -33.0, 2000),
                    charged("HYDRO_CANNON", "Water", 90.0, -50.0, 2000), // legacy / Elite TM
                ),
            )
        assertThat(recommended?.chargedMoveId).isEqualTo("HYDRO_CANNON")
    }

    @Test
    fun `Machamp (Fighting) - charged move is Dynamic Punch`() {
        val recommended =
            MovesetRanker.recommend(
                listOf("Fighting"),
                listOf(
                    fast("BULLET_PUNCH_FAST", "Steel", 10.0, 11.0, 1000),
                    fast("COUNTER_FAST", "Fighting", 13.0, 9.0, 1000),
                    fast("KARATE_CHOP_FAST", "Fighting", 10.0, 13.0, 1000), // legacy
                    charged("HEAVY_SLAM", "Steel", 70.0, -50.0, 2000),
                    charged("DYNAMIC_PUNCH", "Fighting", 85.0, -50.0, 2500),
                    charged("CLOSE_COMBAT", "Fighting", 105.0, -100.0, 2500),
                    charged("ROCK_SLIDE", "Rock", 75.0, -50.0, 2500),
                    charged("CROSS_CHOP", "Fighting", 50.0, -50.0, 1500),
                    charged("STONE_EDGE", "Rock", 105.0, -100.0, 2500), // legacy
                    charged("SUBMISSION", "Fighting", 55.0, -50.0, 2000), // legacy
                    charged("PAYBACK", "Dark", 95.0, -100.0, 2000), // legacy
                ),
            )
        assertThat(recommended?.chargedMoveId).isEqualTo("DYNAMIC_PUNCH")
    }

    @Test
    fun `Gengar (Ghost Poison) - charged move is Shadow Ball`() {
        val recommended =
            MovesetRanker.recommend(
                listOf("Ghost", "Poison"),
                listOf(
                    fast("SUCKER_PUNCH_FAST", "Dark", 5.0, 6.0, 500),
                    fast("HEX_FAST", "Ghost", 8.0, 13.0, 1000),
                    fast("SHADOW_CLAW_FAST", "Ghost", 6.0, 4.0, 500),
                    fast("LICK_FAST", "Ghost", 5.0, 6.0, 500), // legacy
                    charged("SHADOW_BALL", "Ghost", 100.0, -50.0, 3000),
                    charged("FOCUS_BLAST", "Fighting", 140.0, -100.0, 3500),
                    charged("SLUDGE_BOMB", "Poison", 85.0, -50.0, 2500),
                    charged("DRAIN_PUNCH", "Fighting", 50.0, -33.0, 2500),
                    charged("SLUDGE_WAVE", "Poison", 105.0, -100.0, 3000), // legacy
                    charged("DARK_PULSE", "Dark", 80.0, -50.0, 3000), // legacy
                    charged("PSYCHIC", "Psychic", 95.0, -50.0, 3000), // legacy
                    charged("SHADOW_PUNCH", "Ghost", 35.0, -33.0, 1500), // legacy
                ),
            )
        assertThat(recommended?.chargedMoveId).isEqualTo("SHADOW_BALL")
    }

    @Test
    fun `Metagross (Steel Psychic) - charged move is Meteor Mash (legacy)`() {
        val recommended =
            MovesetRanker.recommend(
                listOf("Steel", "Psychic"),
                listOf(
                    fast("BULLET_PUNCH_FAST", "Steel", 10.0, 11.0, 1000),
                    fast("ZEN_HEADBUTT_FAST", "Psychic", 11.0, 9.0, 1000),
                    fast("FURY_CUTTER_FAST", "Bug", 4.0, 8.0, 500),
                    fast("SHADOW_CLAW_FAST", "Ghost", 6.0, 4.0, 500), // legacy
                    charged("PSYCHIC", "Psychic", 95.0, -50.0, 3000),
                    charged("FLASH_CANNON", "Steel", 100.0, -100.0, 2500),
                    charged("EARTHQUAKE", "Ground", 140.0, -100.0, 3500),
                    charged("METEOR_MASH", "Steel", 100.0, -50.0, 2500), // legacy
                ),
            )
        assertThat(recommended?.chargedMoveId).isEqualTo("METEOR_MASH")
    }

    @Test
    fun `Rhyperior (Ground Rock) - charged move is Rock Wrecker (legacy)`() {
        val recommended =
            MovesetRanker.recommend(
                listOf("Ground", "Rock"),
                listOf(
                    fast("MUD_SLAP_FAST", "Ground", 19.0, 13.0, 1500),
                    fast("SMACK_DOWN_FAST", "Rock", 13.0, 7.0, 1000),
                    charged("SURF", "Water", 60.0, -50.0, 1500),
                    charged("EARTHQUAKE", "Ground", 140.0, -100.0, 3500),
                    charged("STONE_EDGE", "Rock", 105.0, -100.0, 2500),
                    charged("SKULL_BASH", "Normal", 130.0, -100.0, 3000),
                    charged("SUPER_POWER", "Fighting", 85.0, -50.0, 3000),
                    charged("BREAKING_SWIPE", "Dragon", 45.0, -33.0, 1000),
                    charged("DRILL_RUN", "Ground", 85.0, -50.0, 3000),
                    charged("ROCK_WRECKER", "Rock", 110.0, -50.0, 3500), // legacy
                ),
            )
        assertThat(recommended?.chargedMoveId).isEqualTo("ROCK_WRECKER")
    }

    // --- Heuristic behaviour -----------------------------------------------------------------------

    @Nested
    inner class Behaviour {
        @Test
        fun `STAB tips the choice toward a same-type charged move`() {
            // Two charged moves with identical stats; only the type differs. The species-typed one wins
            // on the 1.2x STAB bonus alone.
            val recommended =
                MovesetRanker.recommend(
                    listOf("Fire"),
                    listOf(
                        fast("EMBER", "Fire", 5.0, 10.0, 500),
                        charged("SAME_TYPE", "Fire", 60.0, -50.0, 1500),
                        charged("OFF_TYPE", "Water", 60.0, -50.0, 1500),
                    ),
                )
            assertThat(recommended).isEqualTo(RecommendedMoveset("EMBER", "SAME_TYPE"))
        }

        @Test
        fun `a legacy move wins when it is the strongest option`() {
            // A clearly superior charged move that happens to be legacy must still be recommended.
            val recommended =
                MovesetRanker.recommend(
                    listOf("Fire"),
                    listOf(
                        fast("EMBER", "Fire", 5.0, 10.0, 500),
                        charged("WEAK", "Fire", 35.0, -50.0, 1500),
                        charged("BLAST_BURN_LEGACY", "Fire", 110.0, -50.0, 1500),
                    ),
                )
            assertThat(recommended?.chargedMoveId).isEqualTo("BLAST_BURN_LEGACY")
        }

        @Test
        fun `a pool with no charged move has no recommendation`() {
            val recommended =
                MovesetRanker.recommend(
                    listOf("Fire"),
                    listOf(fast("EMBER", "Fire", 5.0, 10.0, 500)),
                )
            assertThat(recommended).isNull()
        }

        @Test
        fun `a pool with no fast move has no recommendation`() {
            val recommended =
                MovesetRanker.recommend(
                    listOf("Fire"),
                    listOf(charged("FLAMETHROWER", "Fire", 70.0, -50.0, 2000)),
                )
            assertThat(recommended).isNull()
        }

        @Test
        fun `an empty pool has no recommendation`() {
            assertThat(MovesetRanker.recommend(listOf("Fire"), emptyList())).isNull()
        }

        @Test
        fun `STAB match is case-insensitive`() {
            // Species types arrive canonical ("Fire"); guard against a lower-cased move type still
            // earning STAB so ranking never silently loses the bonus on a casing mismatch.
            val recommended =
                MovesetRanker.recommend(
                    listOf("FIRE"),
                    listOf(
                        fast("EMBER", "fire", 5.0, 10.0, 500),
                        charged("SAME_TYPE", "fire", 60.0, -50.0, 1500),
                        charged("OFF_TYPE", "water", 60.0, -50.0, 1500),
                    ),
                )
            assertThat(recommended).isEqualTo(RecommendedMoveset("EMBER", "SAME_TYPE"))
        }
    }
}
