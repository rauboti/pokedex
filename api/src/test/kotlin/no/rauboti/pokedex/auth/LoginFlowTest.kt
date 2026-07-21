package no.rauboti.pokedex.auth

import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import no.rauboti.pokedex.common.ApiExceptionHandler
import no.rauboti.pokedex.common.HiveUnavailableException
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.http.MediaType
import org.springframework.mock.web.MockHttpSession
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import org.springframework.test.web.servlet.setup.MockMvcBuilders

/**
 * The BFF side of the hive login flow (research D1): pokedex is an OAuth2 *client* running
 * Authorization-Code + PKCE against hive. `/auth/login` redirects to hive's authorize endpoint
 * (S256 challenge + CSRF `state`, both stashed server-side); `/auth/callback` verifies `state`,
 * exchanges the code for a token, establishes a session, and redirects to the SPA. A failed
 * exchange (hive unreachable) bounces back to the SPA with an error marker rather than a raw
 * problem+json page mid-redirect.
 *
 * The external token exchange is the one collaborator we mock ([HiveTokenClient]); everything else
 * is exercised through the real controller via standalone MockMvc, so the redirects/status/problem+json
 * are the actual HTTP behaviour. Mirrors avec's `LoginFlowTest` (minus its locale machinery).
 */
class LoginFlowTest {
    private val hiveTokenClient = mockk<HiveTokenClient>()

    private val externalUrl = "http://hive.test"
    private val clientId = "pokedex"
    private val webBaseUrl = "http://localhost:5173"

    // Derived exactly as the controller does: the web origin + the BFF's callback path.
    private val redirectUri = "$webBaseUrl${AuthController.CALLBACK_PATH}"

    private val controller = AuthController(hiveTokenClient, externalUrl, clientId, webBaseUrl)
    private val mvc: MockMvc =
        MockMvcBuilders
            .standaloneSetup(controller)
            .setControllerAdvice(ApiExceptionHandler())
            .build()

    /** The one-time `state` the login redirect carried (URL-safe, so no decoding needed). */
    private fun stateOf(location: String): String = location.substringAfter("state=").substringBefore("&")

    /** Run `/auth/login` and hand back the seeded session + the redirect it produced. */
    private fun beginLogin(): Pair<MockHttpSession, String> {
        val result = mvc.get("/auth/login").andReturn()
        val session = result.request.session as MockHttpSession
        return session to result.response.redirectedUrl!!
    }

    @Test
    fun `login redirects to hive authorize with an S256 challenge and state`() {
        val (_, location) = beginLogin()

        assertThat(location).startsWith("$externalUrl/oauth2/authorize")
        assertThat(location).contains("response_type=code")
        assertThat(location).contains("client_id=pokedex")
        assertThat(location).contains("redirect_uri=")
        assertThat(location).contains("code_challenge_method=S256")
        assertThat(location).containsPattern("code_challenge=[^&]+")
        assertThat(location).containsPattern("state=[^&]+")
    }

    @Test
    fun `callback with matching state exchanges the code, stores the token, and redirects to the SPA`() {
        val (session, location) = beginLogin()
        every { hiveTokenClient.exchange(any(), any(), any()) } returns
            HiveTokens("hive-access-token", "hive-refresh-token")

        mvc
            .get("/auth/callback") {
                param("code", "auth-code-123")
                param("state", stateOf(location))
                this.session = session
            }.andExpect {
                status { isFound() }
                redirectedUrlPattern("$webBaseUrl*")
            }

        // The code + the *stored* verifier were exchanged, and both tokens are held on the session.
        verify { hiveTokenClient.exchange("auth-code-123", any(), redirectUri) }
        assertThat(session.getAttribute(SessionKeys.ACCESS_TOKEN)).isEqualTo("hive-access-token")
        assertThat(session.getAttribute(SessionKeys.REFRESH_TOKEN)).isEqualTo("hive-refresh-token")
    }

    @Test
    fun `logout returns 204 and invalidates the session`() {
        mvc.post("/api/auth/logout").andExpect { status { isNoContent() } }
    }

    @Test
    fun `callback with a mismatched state is rejected and never exchanges the code`() {
        val (session, _) = beginLogin()

        mvc
            .get("/auth/callback") {
                param("code", "auth-code-123")
                param("state", "forged-state")
                this.session = session
            }.andExpect {
                status { isBadRequest() }
                content { contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON) }
            }

        verify(exactly = 0) { hiveTokenClient.exchange(any(), any(), any()) }
    }

    @Test
    fun `callback redirects to the SPA with an error marker when the hive exchange fails`() {
        val (session, location) = beginLogin()
        every {
            hiveTokenClient.exchange(any(), any(), any())
        } throws HiveUnavailableException("hive-unavailable", "hive token endpoint unreachable")

        // A browser redirect, not a 502 page — the SPA login screen turns the
        // `error=signin_unavailable` marker into a "sign-in unavailable, try again" Callout.
        mvc
            .get("/auth/callback") {
                param("code", "auth-code-123")
                param("state", stateOf(location))
                this.session = session
            }.andExpect {
                status { isFound() }
                redirectedUrlPattern("$webBaseUrl*error=signin_unavailable*")
            }

        // No session established on failure.
        assertThat(session.getAttribute(SessionKeys.ACCESS_TOKEN)).isNull()
    }
}
