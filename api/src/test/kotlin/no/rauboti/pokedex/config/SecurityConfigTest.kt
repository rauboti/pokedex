package no.rauboti.pokedex.config

import io.mockk.mockk
import no.rauboti.pokedex.auth.HiveTokenClient
import no.rauboti.pokedex.support.IntegrationTest
import org.hamcrest.Matcher
import org.hamcrest.Matchers.allOf
import org.hamcrest.Matchers.equalTo
import org.hamcrest.Matchers.not
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Import
import org.springframework.context.annotation.Primary
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.request.RequestPostProcessor
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.util.UUID

/**
 * The BFF security chain from pokedex's side (T008, research D1): a *consumer* of hive that validates
 * hive-issued JWTs offline. This exercises the wired [SecurityConfig] end-to-end through the real
 * filter chain (full context + actuator + Flyway'd Postgres), asserting only the authz outcomes —
 * the claim validators/authorities mapping are proven in isolation by [JwtValidationTest].
 *
 * Authenticated callers use spring-security-test's `jwt()` post-processor: it pre-populates the
 * `SecurityContext`, which [SessionTokenAuthenticationFilter] leaves intact (it only fills an empty
 * context), so authorities and `hasRole(...)` are exercised exactly as in production.
 */
@AutoConfigureMockMvc
@Import(SecurityConfigTest.StubHiveTokenClient::class)
class SecurityConfigTest : IntegrationTest() {
    /**
     * [SessionTokenAuthenticationFilter] needs a [HiveTokenClient] bean; the production RestClient
     * implementation lands with the auth BFF (T009). Never invoked here — the `jwt()`
     * post-processor authenticates before the filter would consult the session. `@Primary` keeps
     * this stub winning once the production `@Component` exists.
     */
    @TestConfiguration(proxyBeanMethods = false)
    class StubHiveTokenClient {
        @Bean
        @Primary
        fun hiveTokenClient(): HiveTokenClient = mockk()
    }

    @Autowired private lateinit var mvc: MockMvc

    /** An authenticated caller: `sub` = [sub], authorities = `ROLE_<role>` (+ a matching `roles` claim). */
    private fun user(
        sub: UUID = UUID.randomUUID(),
        vararg roles: String,
    ): RequestPostProcessor =
        jwt()
            .jwt { it.subject(sub.toString()).claim("roles", roles.toList()) }
            .authorities(roles.map { SimpleGrantedAuthority("ROLE_$it") })

    @Test
    fun `unauthenticated api call returns 401`() {
        mvc.get("/api/auth/me").andExpect { status { isUnauthorized() } }
        mvc.get("/api/pokemon").andExpect { status { isUnauthorized() } }
    }

    @Test
    fun `an authenticated user without a pokedex role is forbidden from the pokemon API`() {
        // Hive issues aud=pokedex with an empty roles list when the user has no pokedex grant.
        mvc
            .get("/api/pokemon") { with(user()) }
            .andExpect { status { isForbidden() } }
    }

    // Not 401 (authenticated) and not 403 (authorized) — the request cleared the security chain.
    // The endpoint itself lands in US1 (T017); here we only assert the authz boundary is passed.
    private val clearedSecurity: Matcher<Int> = allOf(not(equalTo(401)), not(equalTo(403)))

    @Test
    fun `a user-role caller clears the security chain for the pokemon API`() {
        mvc
            .get("/api/pokemon") { with(user(roles = arrayOf("user"))) }
            .andExpect { match(status().`is`(clearedSecurity)) }
    }

    @Test
    fun `an admin-role caller also clears the security chain (admin-only token)`() {
        // Admins may authenticate with roles=[admin] (no "user"), so the data API must accept
        // `admin` too — hence hasAnyRole("user", "admin"), not hasRole("user"). (Admin additionally
        // unlocks the admin-only catalog sync, gated per-endpoint in T010.)
        mvc
            .get("/api/pokemon") { with(user(roles = arrayOf("admin"))) }
            .andExpect { match(status().`is`(clearedSecurity)) }
    }

    @Test
    fun `the actuator health probe is public`() {
        mvc.get("/actuator/health").andExpect { status { isOk() } }
    }
}
