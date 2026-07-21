package no.rauboti.pokedex.auth

/**
 * The server-side session attribute keys for the hive login (BFF; research D1). The browser holds
 * only the session cookie — every token and the one-time login secrets live on the [jakarta.servlet.http.HttpSession].
 *
 * Centralised here because the collaborators share them: [no.rauboti.pokedex.config.SessionTokenAuthenticationFilter]
 * reads/renews [ACCESS_TOKEN]/[REFRESH_TOKEN] on every API request (T008), and `AuthController`
 * writes the OAuth keys across the Authorization-Code + PKCE dance (T009).
 */
object SessionKeys {
    /** CSRF `state` minted at `/auth/login`, verified at `/auth/callback` (one-time). */
    const val STATE = "pokedex.oauth.state"

    /** PKCE `code_verifier` minted at `/auth/login`, sent in the token exchange (one-time). */
    const val VERIFIER = "pokedex.oauth.verifier"

    /** The short-lived hive access token — authenticates API requests via the session filter. */
    const val ACCESS_TOKEN = "pokedex.hive.accessToken"

    /** The rotating hive refresh token — renews the access token silently, server-side. */
    const val REFRESH_TOKEN = "pokedex.hive.refreshToken"
}
