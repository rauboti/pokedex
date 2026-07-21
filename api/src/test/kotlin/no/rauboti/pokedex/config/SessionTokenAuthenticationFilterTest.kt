package no.rauboti.pokedex.config

import io.mockk.every
import io.mockk.mockk
import no.rauboti.pokedex.auth.HiveTokenClient
import no.rauboti.pokedex.auth.HiveTokens
import no.rauboti.pokedex.auth.SessionKeys
import no.rauboti.pokedex.common.HiveUnavailableException
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.springframework.mock.web.MockFilterChain
import org.springframework.mock.web.MockHttpServletRequest
import org.springframework.mock.web.MockHttpServletResponse
import org.springframework.mock.web.MockHttpSession
import org.springframework.security.authentication.AnonymousAuthenticationToken
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.oauth2.jwt.BadJwtException
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter

/**
 * Unit tests for the BFF session-auth filter (T008): it authenticates a request from the
 * session-stored access token, silently refreshes an expired one server-side, and drops the session
 * (leaving the request unauthenticated) when even the refresh fails. Collaborators are MockK'd; the
 * authorities converter is the real one, so `roles` → `ROLE_*` is exercised too. Mirrors avec's
 * `SessionTokenAuthenticationFilterTest`.
 */
class SessionTokenAuthenticationFilterTest {
    private val jwtDecoder = mockk<JwtDecoder>()
    private val hiveTokenClient = mockk<HiveTokenClient>()
    private val converter =
        JwtAuthenticationConverter().apply {
            setJwtGrantedAuthoritiesConverter(PokedexJwtAuthoritiesConverter())
        }
    private val filter = SessionTokenAuthenticationFilter(jwtDecoder, converter, hiveTokenClient)

    @AfterEach
    fun clearContext() = SecurityContextHolder.clearContext()

    private fun jwtWithRoles(vararg roles: String): Jwt =
        Jwt
            .withTokenValue("token")
            .header("alg", "RS256")
            .subject("user-1")
            .claim("roles", roles.toList())
            .build()

    /** Run the filter over a request carrying [session] (or none). */
    private fun runFilter(session: MockHttpSession?) {
        val request = MockHttpServletRequest().apply { session?.let { setSession(it) } }
        filter.doFilter(request, MockHttpServletResponse(), MockFilterChain())
    }

    private fun authorities(): List<String?> =
        SecurityContextHolder
            .getContext()
            .authentication
            ?.authorities
            ?.map { it.authority } ?: emptyList()

    @Test
    fun `a valid session access token authenticates the request with its roles`() {
        val session = MockHttpSession().apply { setAttribute(SessionKeys.ACCESS_TOKEN, "good-token") }
        every { jwtDecoder.decode("good-token") } returns jwtWithRoles("admin", "user")

        runFilter(session)

        // (Spring Security 7 also adds a framework FACTOR_BEARER authority; we only assert the roles.)
        assertThat(authorities()).contains("ROLE_admin", "ROLE_user")
    }

    @Test
    fun `a valid token authenticates even when an anonymous authentication is already present`() {
        // Spring Security's AnonymousAuthenticationFilter runs before this filter and installs a
        // non-null anonymous token. The filter must treat that as "not yet authenticated" and still
        // decode the session token — otherwise every API request stays anonymous and gets a 401.
        SecurityContextHolder.getContext().authentication =
            AnonymousAuthenticationToken(
                "key",
                "anonymousUser",
                listOf(SimpleGrantedAuthority("ROLE_ANONYMOUS")),
            )
        val session = MockHttpSession().apply { setAttribute(SessionKeys.ACCESS_TOKEN, "good-token") }
        every { jwtDecoder.decode("good-token") } returns jwtWithRoles("user")

        runFilter(session)

        assertThat(authorities()).contains("ROLE_user")
    }

    @Test
    fun `an expired access token is refreshed silently and the session is updated`() {
        val session =
            MockHttpSession().apply {
                setAttribute(SessionKeys.ACCESS_TOKEN, "expired-token")
                setAttribute(SessionKeys.REFRESH_TOKEN, "refresh-1")
            }
        every { jwtDecoder.decode("expired-token") } throws BadJwtException("expired")
        every { hiveTokenClient.refresh("refresh-1") } returns HiveTokens("fresh-access", "refresh-2")
        every { jwtDecoder.decode("fresh-access") } returns jwtWithRoles("user")

        runFilter(session)

        assertThat(authorities()).contains("ROLE_user")
        assertThat(session.getAttribute(SessionKeys.ACCESS_TOKEN)).isEqualTo("fresh-access")
        assertThat(session.getAttribute(SessionKeys.REFRESH_TOKEN)).isEqualTo("refresh-2")
    }

    @Test
    fun `when refresh fails the request stays unauthenticated and the dead tokens are dropped`() {
        val session =
            MockHttpSession().apply {
                setAttribute(SessionKeys.ACCESS_TOKEN, "expired-token")
                setAttribute(SessionKeys.REFRESH_TOKEN, "refresh-1")
            }
        every { jwtDecoder.decode("expired-token") } throws BadJwtException("expired")
        every { hiveTokenClient.refresh("refresh-1") } throws
            HiveUnavailableException("hive-unavailable", "Hive down")

        runFilter(session)

        assertThat(SecurityContextHolder.getContext().authentication).isNull()
        assertThat(session.getAttribute(SessionKeys.ACCESS_TOKEN)).isNull()
        assertThat(session.getAttribute(SessionKeys.REFRESH_TOKEN)).isNull()
    }

    @Test
    fun `a request with no session is left unauthenticated`() {
        runFilter(null)
        assertThat(SecurityContextHolder.getContext().authentication).isNull()
    }
}
