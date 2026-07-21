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
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import org.springframework.test.web.servlet.request.RequestPostProcessor
import java.util.UUID

/**
 * `GET /api/pokemon` and `GET /api/pokemon/{id}` (US1): the collection is caller-scoped (FR-014),
 * the derived block is recomputed on read (research D7), Best-Buddy rows carry the extra projection,
 * and a by-id read is 404 for another user's row or an unknown id (indistinguishable — analyze C2).
 */
@AutoConfigureMockMvc
class PokemonListApiTest : IntegrationTest() {
    @Autowired private lateinit var mvc: MockMvc

    @Autowired private lateinit var jdbc: JdbcClient

    private val userA = UUID.randomUUID()
    private val userB = UUID.randomUUID()

    @BeforeEach
    fun seed() = seedCatalog(jdbc)

    private fun user(sub: UUID): RequestPostProcessor =
        jwt()
            .jwt { it.subject(sub.toString()).claim("roles", listOf("user")) }
            .authorities(SimpleGrantedAuthority("ROLE_user"))

    /** Register a Pokémon as [sub] and return its id. */
    private fun register(
        sub: UUID,
        body: String,
    ): String {
        val response =
            mvc
                .post("/api/pokemon") {
                    contentType = MediaType.APPLICATION_JSON
                    content = body
                    with(user(sub))
                }.andReturn()
                .response.contentAsString
        return Regex("\"id\":\"([^\"]+)\"").find(response)!!.groupValues[1]
    }

    @Test
    fun `the collection lists only the caller's rows`() {
        register(userA, """{"speciesId":"VENUSAUR","ivAtk":15,"ivDef":15,"ivSta":15,"cp":2720}""")
        register(userB, """{"speciesId":"MAGIKARP","ivAtk":0,"ivDef":0,"ivSta":0,"cp":10,"level":1.5}""")

        mvc
            .get("/api/pokemon") { with(user(userA)) }
            .andExpect {
                status { isOk() }
                jsonPath("$.length()") { value(1) }
                jsonPath("$[0].species.id") { value("VENUSAUR") }
                jsonPath("$[0].derived.level") { value(40.0) }
            }
    }

    @Test
    fun `a Best-Buddy Pokemon carries the extra projection`() {
        register(userA, """{"speciesId":"VENUSAUR","ivAtk":15,"ivDef":15,"ivSta":15,"cp":2720,"bestBuddy":true}""")

        mvc
            .get("/api/pokemon") { with(user(userA)) }
            .andExpect {
                status { isOk() }
                jsonPath("$[0].derived.projections.length()") { value(3) } // L40, L50, BEST_BUDDY
                jsonPath("$[0].derived.projections[2].label") { value("BEST_BUDDY") }
            }
    }

    @Test
    fun `a by-id read returns the caller's own row with its derived block`() {
        val id = register(userA, """{"speciesId":"VENUSAUR","ivAtk":15,"ivDef":15,"ivSta":15,"cp":2720}""")

        mvc
            .get("/api/pokemon/$id") { with(user(userA)) }
            .andExpect {
                status { isOk() }
                jsonPath("$.id") { value(id) }
                jsonPath("$.derived.perfect") { value(true) }
            }
    }

    @Test
    fun `a by-id read of another user's row is a 404`() {
        val id = register(userA, """{"speciesId":"VENUSAUR","ivAtk":15,"ivDef":15,"ivSta":15,"cp":2720}""")

        mvc.get("/api/pokemon/$id") { with(user(userB)) }.andExpect { status { isNotFound() } }
    }

    @Test
    fun `a by-id read of an unknown id is a 404`() {
        mvc.get("/api/pokemon/${UUID.randomUUID()}") { with(user(userA)) }.andExpect { status { isNotFound() } }
    }

    @Test
    fun `unauthenticated is a 401`() {
        mvc.get("/api/pokemon").andExpect { status { isUnauthorized() } }
    }
}
