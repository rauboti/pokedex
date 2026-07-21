package no.rauboti.pokedex.pokemon

import no.rauboti.pokedex.support.IntegrationTest
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.post
import org.springframework.test.web.servlet.request.RequestPostProcessor
import java.util.UUID

/**
 * `POST /api/pokemon` (US1): the API re-runs the solver and applies the data-model write invariants
 * — registrable species (0), solver-confirmed level with collision disambiguation (1), 422 on an
 * impossible combination (SC-004). The 201 response carries the full derived block (level, HP,
 * effective stats, IV%, projections) computed server-side (research D7).
 */
@AutoConfigureMockMvc
class PokemonCreateApiTest : IntegrationTest() {
    @Autowired private lateinit var mvc: MockMvc

    @Autowired private lateinit var jdbc: JdbcClient

    @BeforeEach
    fun seed() = seedCatalog(jdbc)

    private fun user(vararg roles: String): RequestPostProcessor =
        jwt()
            .jwt { it.subject(UUID.randomUUID().toString()).claim("roles", roles.toList()) }
            .authorities(roles.map { SimpleGrantedAuthority("ROLE_$it") })

    private fun postPokemon(
        body: String,
        vararg roles: String = arrayOf("user"),
    ) = mvc.post("/api/pokemon") {
        contentType = MediaType.APPLICATION_JSON
        content = body
        with(user(*roles))
    }

    @Test
    fun `registers a hundo and returns the full derived block`() {
        postPokemon("""{"speciesId":"VENUSAUR","ivAtk":15,"ivDef":15,"ivSta":15,"cp":2720}""")
            .andExpect {
                status { isCreated() }
                jsonPath("$.species.id") { value("VENUSAUR") }
                jsonPath("$.cp") { value(2720) }
                jsonPath("$.derived.level") { value(40.0) }
                jsonPath("$.derived.hp") { value(162) }
                jsonPath("$.derived.ivPercent") { value(100.0) }
                jsonPath("$.derived.perfect") { value(true) }
                jsonPath("$.derived.projections.length()") { value(2) } // L40 + L50, no Best Buddy
                jsonPath("$.stale") { value(false) }
            }
    }

    @Test
    fun `an unambiguous input needs no level`() {
        // Single candidate (level 40) — omitting `level` is fine.
        postPokemon("""{"speciesId":"VENUSAUR","ivAtk":15,"ivDef":15,"ivSta":15,"cp":2720}""")
            .andExpect {
                status { isCreated() }
                jsonPath("$.derived.level") { value(40.0) }
            }
    }

    @Test
    fun `a CP collision without a level is rejected with the candidates listed`() {
        postPokemon("""{"speciesId":"MAGIKARP","ivAtk":0,"ivDef":0,"ivSta":0,"cp":10}""")
            .andExpect {
                status { isUnprocessableContent() }
                jsonPath("$.code") { value("level-not-a-candidate") }
                jsonPath("$.detail") { value(org.hamcrest.Matchers.containsString("1.0")) }
            }
    }

    @Test
    fun `a CP collision with a chosen candidate level is accepted`() {
        postPokemon("""{"speciesId":"MAGIKARP","ivAtk":0,"ivDef":0,"ivSta":0,"cp":10,"level":1.5}""")
            .andExpect {
                status { isCreated() }
                jsonPath("$.derived.level") { value(1.5) }
            }
    }

    @Test
    fun `an impossible combination is a 422`() {
        postPokemon("""{"speciesId":"VENUSAUR","ivAtk":15,"ivDef":15,"ivSta":15,"cp":99999}""")
            .andExpect {
                status { isUnprocessableContent() }
                jsonPath("$.code") { value("impossible-combination") }
            }
    }

    @Test
    fun `a non-registrable species is a 422`() {
        postPokemon("""{"speciesId":"VENUSAUR_MEGA","ivAtk":15,"ivDef":15,"ivSta":15,"cp":2720}""")
            .andExpect {
                status { isUnprocessableContent() }
                jsonPath("$.code") { value("species-not-registrable") }
            }
    }

    @Test
    fun `flags persist and shadow does not change the derived values`() {
        postPokemon("""{"speciesId":"VENUSAUR","ivAtk":15,"ivDef":15,"ivSta":15,"cp":2720,"shiny":true,"shadow":true}""")
            .andExpect {
                status { isCreated() }
                jsonPath("$.flags.shiny") { value(true) }
                jsonPath("$.flags.shadow") { value(true) }
                jsonPath("$.derived.level") { value(40.0) } // shadow is display-only
            }
    }

    @Test
    fun `an unknown species is a 404`() {
        postPokemon("""{"speciesId":"NOSUCHMON","ivAtk":15,"ivDef":15,"ivSta":15,"cp":100}""")
            .andExpect {
                status { isNotFound() }
                jsonPath("$.code") { value("unknown-species") }
            }
    }

    @Test
    fun `a caller without a pokedex role is forbidden`() {
        postPokemon("""{"speciesId":"VENUSAUR","ivAtk":15,"ivDef":15,"ivSta":15,"cp":2720}""", roles = arrayOf())
            .andExpect { status { isForbidden() } }
    }

    @Test
    fun `unauthenticated is a 401`() {
        mvc
            .post("/api/pokemon") {
                contentType = MediaType.APPLICATION_JSON
                content = """{"speciesId":"VENUSAUR","ivAtk":15,"ivDef":15,"ivSta":15,"cp":2720}"""
            }.andExpect { status { isUnauthorized() } }
    }
}
