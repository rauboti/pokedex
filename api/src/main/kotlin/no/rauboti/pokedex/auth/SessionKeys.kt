package no.rauboti.pokedex.auth

/**
 * Server-side session attribute keys for the hive login. Centralised because `AuthController` writes
 * them across the PKCE handshake and `SessionTokenAuthenticationFilter` reads and renews them.
 */
object SessionKeys {
    /** CSRF `state`, minted at login and verified once at the callback. */
    const val STATE = "pokedex.oauth.state"

    /** PKCE `code_verifier`, minted at login and spent once in the token exchange. */
    const val VERIFIER = "pokedex.oauth.verifier"

    const val ACCESS_TOKEN = "pokedex.hive.accessToken"

    const val REFRESH_TOKEN = "pokedex.hive.refreshToken"
}
