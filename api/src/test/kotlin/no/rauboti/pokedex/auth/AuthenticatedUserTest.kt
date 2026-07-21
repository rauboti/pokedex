package no.rauboti.pokedex.auth

import no.rauboti.pokedex.support.IntegrationTest
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get

/**
 * Tests for `GET /api/auth/me`. The 401-when-unauthenticated path goes through the real security
 * chain (no session → [no.rauboti.pokedex.config.SessionTokenAuthenticationFilter] leaves it
 * unauthenticated → 401 entry point). The field mapping is checked by calling the controller
 * directly with a built [Jwt] — the token is validated + placed by the filter in production, so
 * here we only assert the claims-to-[AuthenticatedUser] projection (contract `Me`: sub + name +
 * flat roles list). Mirrors avec's `AuthenticatedUserTest` (pokedex has no locale).
 */
@AutoConfigureMockMvc
class AuthenticatedUserTest : IntegrationTest() {
    @Autowired private lateinit var mvc: MockMvc

    @Autowired private lateinit var controller: AuthController

    private fun token(roles: List<String>? = listOf("user")): Jwt =
        Jwt
            .withTokenValue("token")
            .header("alg", "RS256")
            .subject("10000000-0000-4000-8000-000000000001")
            .claim("name", "Ada Lovelace")
            .apply { roles?.let { claim("roles", it) } }
            .build()

    @Test
    fun `me returns 401 when unauthenticated`() {
        mvc.get("/api/auth/me").andExpect { status { isUnauthorized() } }
    }

    @Test
    fun `me projects the token's sub, name and roles onto the me response`() {
        val me = controller.me(token(roles = listOf("admin", "user")))

        assertThat(me.sub).isEqualTo("10000000-0000-4000-8000-000000000001")
        assertThat(me.name).isEqualTo("Ada Lovelace")
        assertThat(me.roles).containsExactly("admin", "user")
    }

    @Test
    fun `me returns an empty roles list when the token carries no pokedex roles`() {
        // A signed-in hive user without a pokedex grant: empty or absent roles claim. The SPA uses
        // the empty list for its no-access screen; the data API answers 403 server-side regardless.
        assertThat(controller.me(token(roles = emptyList())).roles).isEmpty()
        assertThat(controller.me(token(roles = null)).roles).isEmpty()
    }
}
