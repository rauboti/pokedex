package no.rauboti.pokedex.gamedata

import io.mockk.every
import io.mockk.mockk
import no.rauboti.pokedex.common.GamedataUnavailableException
import no.rauboti.pokedex.support.IntegrationTest
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Import
import org.springframework.context.annotation.Primary
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import org.springframework.test.web.servlet.request.RequestPostProcessor
import java.util.UUID

/**
 * Contract tests for the catalog endpoints (research D5). `GET /api/catalog` reports counts +
 * last-sync time + a **caller-scoped** stale count; `POST /api/catalog/sync` is **admin-only**
 * (spec assumption 2026-07-20) and returns the refreshed status, surfacing a 502 problem+json when
 * the source is down. The [GamedataClient] is MockK-stubbed so no test touches the network.
 */
@AutoConfigureMockMvc
@Import(CatalogApiTest.StubGamedataClient::class)
class CatalogApiTest : IntegrationTest() {
    @TestConfiguration(proxyBeanMethods = false)
    class StubGamedataClient {
        @Bean
        @Primary
        fun gamedataClient(): GamedataClient = mockk()
    }

    @Autowired private lateinit var mvc: MockMvc

    @Autowired private lateinit var gamedataClient: GamedataClient

    @Autowired private lateinit var jdbc: JdbcClient

    private val fixture: String =
        checkNotNull(javaClass.getResource("/gamedata/pokedex-fixture.json")).readText()

    @BeforeEach
    fun clean() {
        jdbc.sql("truncate table caught_pokemon, species_move, species, move").update()
    }

    private fun user(vararg roles: String): RequestPostProcessor =
        jwt()
            .jwt { it.subject(UUID.randomUUID().toString()).claim("roles", roles.toList()) }
            .authorities(roles.map { SimpleGrantedAuthority("ROLE_$it") })

    @Test
    fun `catalog status on an empty catalog reports zero counts, null syncedAt and zero stale`() {
        mvc
            .get("/api/catalog") { with(user("user")) }
            .andExpect {
                status { isOk() }
                jsonPath("$.speciesCount") { value(0) }
                jsonPath("$.moveCount") { value(0) }
                jsonPath("$.syncedAt") { value(null) }
                jsonPath("$.stalePokemonCount") { value(0) }
            }
    }

    @Test
    fun `an admin can trigger a sync and gets the refreshed status`() {
        every { gamedataClient.fetchPokedex() } returns fixture

        mvc
            .post("/api/catalog/sync") { with(user("admin")) }
            .andExpect {
                status { isOk() }
                jsonPath("$.speciesCount") { value(5) }
                jsonPath("$.moveCount") { value(11) }
                jsonPath("$.syncedAt") { isNotEmpty() }
            }
    }

    @Test
    fun `a user-role caller may not trigger a sync`() {
        mvc
            .post("/api/catalog/sync") { with(user("user")) }
            .andExpect { status { isForbidden() } }
    }

    @Test
    fun `a sync surfaces 502 problem+json when the game-data source is unavailable`() {
        every { gamedataClient.fetchPokedex() } throws
            GamedataUnavailableException("gamedata-unavailable", "source down")

        mvc
            .post("/api/catalog/sync") { with(user("admin")) }
            .andExpect {
                status { isBadGateway() }
                jsonPath("$.code") { value("gamedata-unavailable") }
            }
    }

    @Test
    fun `catalog status requires authentication`() {
        mvc.get("/api/catalog").andExpect { status { isUnauthorized() } }
    }
}
