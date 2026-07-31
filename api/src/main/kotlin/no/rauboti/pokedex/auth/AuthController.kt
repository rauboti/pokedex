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
 * The BFF's hive login endpoints — see the api README's "Auth model" for the full handshake.
 * The public `/auth` pair *starts* a session; `/api/auth` (`me`, `logout`) are the authenticated
 * SPA calls.
 */
@RestController
class AuthController(
    private val hiveTokenClient: HiveTokenClient,
    @param:Value("\${pokedex.hive.external-url}") private val externalUrl: String,
    @param:Value("\${pokedex.hive.client-id}") private val clientId: String,
    @param:Value("\${pokedex.web.base-url}") private val webBaseUrl: String,
) {
    /** Derived, not separately configured, so it can't drift from the callback mapping. */
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

        val tokens =
            try {
                hiveTokenClient.exchange(code, verifier, redirectUri)
            } catch (_: HiveUnavailableException) {
                // This is a browser redirect, so a 502 problem+json would land as a raw error page.
                return redirectToSpa(mapOf("error" to SIGNIN_UNAVAILABLE))
            }
        session.setAttribute(SessionKeys.ACCESS_TOKEN, tokens.accessToken)
        session.setAttribute(SessionKeys.REFRESH_TOKEN, tokens.refreshToken)

        return redirectToSpa()
    }

    /**
     * hive has no consumer token-revoke endpoint yet, so the refresh token stays valid there until it
     * expires — it is discarded here and never reachable again.
     */
    @PostMapping("/api/auth/logout")
    fun logout(session: HttpSession): ResponseEntity<Void> {
        session.invalidate()
        return ResponseEntity.noContent().build()
    }

    /** Unauthenticated callers never reach here — the security chain answers 401 first. */
    @GetMapping("/api/auth/me")
    fun me(
        @AuthenticationPrincipal jwt: Jwt,
    ): AuthenticatedUser =
        AuthenticatedUser(
            // A validated hive token always carries `sub`; fail loud if not.
            sub = requireNotNull(jwt.subject) { "hive token without a sub claim" },
            name = jwt.getClaimAsString("name"),
            roles = jwt.getClaimAsStringList("roles").orEmpty(),
        )

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
        const val CALLBACK_PATH = "/auth/callback"

        /** Marker the SPA login screen renders as a "sign-in unavailable" Callout. */
        const val SIGNIN_UNAVAILABLE = "signin_unavailable"
    }
}
