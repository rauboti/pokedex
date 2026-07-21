package no.rauboti.pokedex.auth

import jakarta.servlet.http.HttpSession
import no.rauboti.pokedex.common.BadRequestException
import no.rauboti.pokedex.common.HiveUnavailableException
import no.rauboti.pokedex.config.HiveEndpoints
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.util.UriComponentsBuilder
import java.net.URI
import java.security.MessageDigest

/**
 * The BFF's hive login endpoints. `/auth/login` starts Authorization-Code + PKCE: it stashes a CSRF
 * `state` and the PKCE `code_verifier` server-side (session) and redirects the browser to hive's
 * authorize endpoint with the S256 `code_challenge`. `/auth/callback` verifies `state`, exchanges the
 * code for a hive access token (kept server-side, on the session), and redirects to the SPA. A failed
 * exchange (hive unreachable) redirects back to the SPA with `?error=signin_unavailable` so the login
 * screen shows a Callout rather than a raw problem+json page mid-redirect. The `/auth` handshake is
 * public — no session/token is needed to *start* login; the `/api/auth` calls (this file's `logout`
 * and `me`) are the authenticated SPA calls.
 */
@RestController
class AuthController(
    private val hiveTokenClient: HiveTokenClient,
    @param:Value("\${pokedex.hive.external-url}") private val externalUrl: String,
    @param:Value("\${pokedex.hive.client-id}") private val clientId: String,
    @param:Value("\${pokedex.web.base-url}") private val webBaseUrl: String,
) {
    /**
     * OAuth redirect URI = the public web origin + the BFF's own [CALLBACK_PATH]. Derived rather than
     * separately configured, so it can't drift from [webBaseUrl] or the callback mapping. The browser
     * reaches it at the web origin (nginx in Docker, the Vite proxy in dev, both forward `/auth` to
     * this BFF). Must match the redirect URI registered for this client in hive.
     */
    private val redirectUri = "$webBaseUrl$CALLBACK_PATH"

    @GetMapping("/auth/login")
    fun login(session: HttpSession): ResponseEntity<Void> {
        val verifier = Pkce.randomToken()
        val state = Pkce.randomToken()
        session.setAttribute(SessionKeys.STATE, state)
        session.setAttribute(SessionKeys.VERIFIER, verifier)

        val authorize =
            UriComponentsBuilder
                .fromUriString("$externalUrl${HiveEndpoints.AUTHORIZE_PATH}")
                .queryParam("response_type", "code")
                .queryParam("client_id", clientId)
                .queryParam("redirect_uri", redirectUri)
                .queryParam("state", state)
                .queryParam("code_challenge", Pkce.challenge(verifier))
                .queryParam("code_challenge_method", "S256")
                .encode()
                .toUriString()
        return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(authorize)).build()
    }

    @GetMapping(CALLBACK_PATH)
    fun callback(
        @RequestParam code: String,
        @RequestParam state: String,
        session: HttpSession,
    ): ResponseEntity<Void> {
        val expectedState = session.getAttribute(SessionKeys.STATE) as? String
        val verifier = session.getAttribute(SessionKeys.VERIFIER) as? String
        if (expectedState == null || verifier == null || !constantTimeEquals(state, expectedState)) {
            throw BadRequestException("invalid-oauth-state", "Invalid or missing OAuth state.")
        }
        // One-time use: drop the challenge material before the exchange.
        session.removeAttribute(SessionKeys.STATE)
        session.removeAttribute(SessionKeys.VERIFIER)

        // Both tokens are held server-side (session). The access token authenticates API calls (via
        // SessionTokenAuthenticationFilter); the refresh token renews it silently.
        val tokens =
            try {
                hiveTokenClient.exchange(code, verifier, redirectUri)
            } catch (_: HiveUnavailableException) {
                // A browser redirect, so a 502 problem+json would land as a raw error page. Bounce
                // back to the SPA with a marker the login screen turns into a "sign-in unavailable,
                // try again" Callout.
                return redirectToSpa(mapOf("error" to SIGNIN_UNAVAILABLE))
            }
        session.setAttribute(SessionKeys.ACCESS_TOKEN, tokens.accessToken)
        session.setAttribute(SessionKeys.REFRESH_TOKEN, tokens.refreshToken)

        return redirectToSpa()
    }

    /**
     * Drops the server-side tokens by invalidating the session; the SPA then treats the user as
     * logged out. hive has no consumer token-revoke endpoint yet, so the refresh token stays
     * valid at hive until it expires — it's discarded here and never reachable again.
     */
    @PostMapping("/api/auth/logout")
    fun logout(session: HttpSession): ResponseEntity<Void> {
        session.invalidate()
        return ResponseEntity.noContent().build()
    }

    /**
     * The current authenticated player, read from the session-authenticated hive token
     * ([no.rauboti.pokedex.config.SessionTokenAuthenticationFilter] sets the [Jwt] principal).
     * Unauthenticated callers never reach here — the security chain answers 401 first.
     */
    @GetMapping("/api/auth/me")
    fun me(
        @AuthenticationPrincipal jwt: Jwt,
    ): AuthenticatedUser =
        AuthenticatedUser(
            // A hive-issued token always carries `sub` (it's the validated identity); fail loud if not.
            sub = requireNotNull(jwt.subject) { "hive token without a sub claim" },
            name = jwt.getClaimAsString("name"),
            roles = jwt.getClaimAsStringList("roles").orEmpty(),
        )

    /** 302 to the SPA, optionally with query params (e.g. the sign-in-unavailable marker). */
    private fun redirectToSpa(query: Map<String, String> = emptyMap()): ResponseEntity<Void> {
        val target =
            UriComponentsBuilder
                .fromUriString(webBaseUrl)
                .apply { query.forEach { (k, v) -> queryParam(k, v) } }
                .encode()
                .toUriString()
        return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(target)).build()
    }

    /** Timing-safe compare so a mismatched `state` can't be probed byte-by-byte. */
    private fun constantTimeEquals(
        a: String,
        b: String,
    ): Boolean = MessageDigest.isEqual(a.toByteArray(), b.toByteArray())

    companion object {
        /** The BFF's OAuth callback path. Shared by the [callback] mapping and the derived
         *  [redirectUri] so the two can't diverge. */
        const val CALLBACK_PATH = "/auth/callback"

        /** Marker the SPA login screen renders as a "sign-in unavailable" Callout. */
        const val SIGNIN_UNAVAILABLE = "signin_unavailable"
    }
}
