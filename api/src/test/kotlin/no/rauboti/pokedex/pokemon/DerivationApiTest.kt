package no.rauboti.pokedex.pokemon

import no.rauboti.pokedex.support.IntegrationTest
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.post
import org.springframework.test.web.servlet.request.RequestPostProcessor
import java.util.UUID

/**
 * Contract test for `POST /api/derivation` (US1, research D7): the stateless CP→level preview. A
 * unique match returns one candidate; a CP-collision returns every matching level; an impossible
 * combination returns an empty list (SC-004). The collision case is the **CP-floor plateau** at the
 * lowest levels — the only place fixed-IV CP→level collisions occur — where the dust cost is equal
 * across candidates (an informational hint, not the differentiator; spec/data-model amended 2026-07-21).
 */
@AutoConfigureMockMvc
class DerivationApiTest : IntegrationTest() {
    @Autowired private lateinit var mvc: MockMvc

    @Autowired private lateinit var jdbc: JdbcClient

    @BeforeEach
    fun seed() {
        jdbc.sql("truncate table caught_pokemon, species_move, species, move").update()
        insert("VENUSAUR", 3, "Venusaur", 198, 189, 190)
        insert("MAGIKARP", 129, "Magikarp", 29, 85, 85)
    }

    private fun insert(
        id: String,
        dexNr: Int,
        name: String,
        atk: Int,
        def: Int,
        sta: Int,
    ) {
        jdbc
            .sql(
                """
                INSERT INTO species (id, dex_nr, name, form, base_atk, base_def, base_sta,
                                     type_1, type_2, registrable, synced_at)
                VALUES (:id, :dex, :name, NULL, :atk, :def, :sta, 'Normal', NULL, true, now())
                """.trimIndent(),
            ).param("id", id)
            .param("dex", dexNr)
            .param("name", name)
            .param("atk", atk)
            .param("def", def)
            .param("sta", sta)
            .update()
    }

    private fun user(vararg roles: String): RequestPostProcessor =
        jwt()
            .jwt { it.subject(UUID.randomUUID().toString()).claim("roles", roles.toList()) }
            .authorities(roles.map { SimpleGrantedAuthority("ROLE_$it") })

    private fun body(
        speciesId: String,
        ivAtk: Int = 15,
        ivDef: Int = 15,
        ivSta: Int = 15,
        cp: Int,
    ) = """{"speciesId":"$speciesId","ivAtk":$ivAtk,"ivDef":$ivDef,"ivSta":$ivSta,"cp":$cp}"""

    @Test
    fun `a unique match returns one candidate with level, hp, stats and dust cost`() {
        // Venusaur 15/15/15 at CP 2720 resolves to exactly level 40 (GO Hub max CP).
        mvc
            .post("/api/derivation") {
                contentType = org.springframework.http.MediaType.APPLICATION_JSON
                content = body("VENUSAUR", cp = 2720)
                with(user("user"))
            }.andExpect {
                status { isOk() }
                jsonPath("$.candidates.length()") { value(1) }
                jsonPath("$.candidates[0].level") { value(40.0) }
                jsonPath("$.candidates[0].hp") { value(162) }
                jsonPath("$.candidates[0].dustCost") { isNumber() }
            }
    }

    @Test
    fun `a CP collision returns every candidate on the CP-floor plateau with equal dust cost`() {
        // Magikarp 0/0/0 at CP 10: levels 1.0/1.5/2.0/2.5 all floor+clamp to 10 (the only collision
        // shape). Dust ties at 200 across the plateau — a hint, not the differentiator.
        mvc
            .post("/api/derivation") {
                contentType = org.springframework.http.MediaType.APPLICATION_JSON
                content = body("MAGIKARP", 0, 0, 0, cp = 10)
                with(user("user"))
            }.andExpect {
                status { isOk() }
                jsonPath("$.candidates.length()") { value(4) }
                jsonPath("$.candidates[0].level") { value(1.0) }
                jsonPath("$.candidates[3].level") { value(2.5) }
                jsonPath("$.candidates[0].dustCost") { value(200) }
                jsonPath("$.candidates[3].dustCost") { value(200) }
            }
    }

    @Test
    fun `an impossible combination returns no candidates`() {
        mvc
            .post("/api/derivation") {
                contentType = org.springframework.http.MediaType.APPLICATION_JSON
                content = body("VENUSAUR", cp = 99999)
                with(user("user"))
            }.andExpect {
                status { isOk() }
                jsonPath("$.candidates.length()") { value(0) }
            }
    }

    @Test
    fun `an unknown species is a 404`() {
        mvc
            .post("/api/derivation") {
                contentType = org.springframework.http.MediaType.APPLICATION_JSON
                content = body("NOSUCHMON", cp = 100)
                with(user("user"))
            }.andExpect {
                status { isNotFound() }
                jsonPath("$.code") { value("unknown-species") }
            }
    }

    @Test
    fun `an out-of-range IV is a 400`() {
        mvc
            .post("/api/derivation") {
                contentType = org.springframework.http.MediaType.APPLICATION_JSON
                content = body("VENUSAUR", ivAtk = 16, cp = 100)
                with(user("user"))
            }.andExpect { status { isBadRequest() } }
    }

    @Test
    fun `a CP below the floor is a 400`() {
        mvc
            .post("/api/derivation") {
                contentType = org.springframework.http.MediaType.APPLICATION_JSON
                content = body("VENUSAUR", cp = 9)
                with(user("user"))
            }.andExpect { status { isBadRequest() } }
    }

    @Test
    fun `requires authentication`() {
        mvc
            .post("/api/derivation") {
                contentType = org.springframework.http.MediaType.APPLICATION_JSON
                content = body("VENUSAUR", cp = 2720)
            }.andExpect { status { isUnauthorized() } }
    }
}
