package no.rauboti.pokedex.species

import no.rauboti.pokedex.support.IntegrationTest
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.request.RequestPostProcessor
import java.util.UUID

/**
 * Contract test for `GET /api/species/{id}/moves` (US5): the species' move pool split into
 * fast/charged with `legacy` markers, plus the sync-computed `recommended` pairing (research D8) or
 * null when the pool has no recommendation. An unknown species is 404; unauthenticated is 401.
 */
@AutoConfigureMockMvc
class SpeciesMovesApiTest : IntegrationTest() {
    @Autowired private lateinit var mvc: MockMvc

    @Autowired private lateinit var jdbc: JdbcClient

    @BeforeEach
    fun seed() {
        jdbc.sql("truncate table caught_pokemon, species_move, species, move").update()

        // Venusaur with a small Grass/Poison pool; Frenzy Plant is a legacy (Elite-TM) charged move.
        move("RAZOR_LEAF_FAST", "Razor Leaf", "Grass", fast = true)
        move("VINE_WHIP_FAST", "Vine Whip", "Grass", fast = true)
        move("FRENZY_PLANT", "Frenzy Plant", "Grass", fast = false)
        move("POWER_WHIP", "Power Whip", "Grass", fast = false)
        move("SLUDGE_BOMB", "Sludge Bomb", "Poison", fast = false)

        // Recommended pairing set (mirrors what the sync ranker computes for this fixture pool).
        species("VENUSAUR", "Venusaur", "Grass", "Poison", "VINE_WHIP_FAST", "FRENZY_PLANT")
        pool("VENUSAUR", "RAZOR_LEAF_FAST", legacy = false)
        pool("VENUSAUR", "VINE_WHIP_FAST", legacy = false)
        pool("VENUSAUR", "FRENZY_PLANT", legacy = true)
        pool("VENUSAUR", "POWER_WHIP", legacy = false)
        pool("VENUSAUR", "SLUDGE_BOMB", legacy = false)

        // Charmander: a pool but no computed recommendation (columns null).
        move("SCRATCH_FAST", "Scratch", "Normal", fast = true)
        move("FLAME_CHARGE", "Flame Charge", "Fire", fast = false)
        species("CHARMANDER", "Charmander", "Fire", null, null, null)
        pool("CHARMANDER", "SCRATCH_FAST", legacy = false)
        pool("CHARMANDER", "FLAME_CHARGE", legacy = false)
    }

    @Test
    fun `returns the pool split into fast and charged with legacy markers and the recommendation`() {
        mvc
            .get("/api/species/VENUSAUR/moves") { with(user("user")) }
            .andExpect {
                status { isOk() }
                jsonPath("$.speciesId") { value("VENUSAUR") }

                // Fast moves (ordered by name): Razor Leaf, Vine Whip — both non-legacy.
                jsonPath("$.fastMoves.length()") { value(2) }
                jsonPath("$.fastMoves[0].id") { value("RAZOR_LEAF_FAST") }
                jsonPath("$.fastMoves[0].fast") { value(true) }
                jsonPath("$.fastMoves[0].legacy") { value(false) }
                jsonPath("$.fastMoves[0].type") { value("Grass") }

                // Charged moves (ordered by name): Frenzy Plant (legacy), Power Whip, Sludge Bomb.
                jsonPath("$.chargedMoves.length()") { value(3) }
                jsonPath("$.chargedMoves[0].id") { value("FRENZY_PLANT") }
                jsonPath("$.chargedMoves[0].fast") { value(false) }
                jsonPath("$.chargedMoves[0].legacy") { value(true) }

                jsonPath("$.recommended.fastMoveId") { value("VINE_WHIP_FAST") }
                jsonPath("$.recommended.chargedMoveId") { value("FRENZY_PLANT") }
            }
    }

    @Test
    fun `recommended is null when the species has no computed recommendation`() {
        mvc
            .get("/api/species/CHARMANDER/moves") { with(user("user")) }
            .andExpect {
                status { isOk() }
                jsonPath("$.recommended") { value(null as String?) }
                jsonPath("$.fastMoves.length()") { value(1) }
                jsonPath("$.chargedMoves.length()") { value(1) }
            }
    }

    @Test
    fun `an unknown species is a 404`() {
        mvc
            .get("/api/species/NOPE/moves") { with(user("user")) }
            .andExpect { status { isNotFound() } }
    }

    @Test
    fun `requires authentication`() {
        mvc.get("/api/species/VENUSAUR/moves").andExpect { status { isUnauthorized() } }
    }

    // --- seeding helpers -----------------------------------------------------

    private fun move(
        id: String,
        name: String,
        type: String,
        fast: Boolean,
    ) {
        jdbc
            .sql(
                """
                INSERT INTO move (id, name, type, is_fast, power, energy, duration_ms, synced_at)
                VALUES (:id, :name, :type, :fast, 50, 10, 1000, now())
                """.trimIndent(),
            ).param("id", id)
            .param("name", name)
            .param("type", type)
            .param("fast", fast)
            .update()
    }

    private fun species(
        id: String,
        name: String,
        type1: String,
        type2: String?,
        recommendedFast: String?,
        recommendedCharged: String?,
    ) {
        jdbc
            .sql(
                """
                INSERT INTO species (id, dex_nr, name, form, base_atk, base_def, base_sta,
                                     type_1, type_2, registrable, recommended_fast_move_id,
                                     recommended_charged_move_id, synced_at)
                VALUES (:id, 1, :name, null, 198, 189, 190, :t1, :t2, true, :recFast, :recCharged, now())
                """.trimIndent(),
            ).param("id", id)
            .param("name", name)
            .param("t1", type1)
            .param("t2", type2)
            .param("recFast", recommendedFast)
            .param("recCharged", recommendedCharged)
            .update()
    }

    private fun pool(
        speciesId: String,
        moveId: String,
        legacy: Boolean,
    ) {
        jdbc
            .sql("INSERT INTO species_move (species_id, move_id, legacy) VALUES (:sid, :mid, :legacy)")
            .param("sid", speciesId)
            .param("mid", moveId)
            .param("legacy", legacy)
            .update()
    }

    private fun user(vararg roles: String): RequestPostProcessor =
        jwt()
            .jwt { it.subject(UUID.randomUUID().toString()).claim("roles", roles.toList()) }
            .authorities(roles.map { SimpleGrantedAuthority("ROLE_$it") })
}
