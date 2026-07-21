package no.rauboti.pokedex.auth

/** A hive token pair: the short-lived access token and the rotating refresh token. */
data class HiveTokens(
    val accessToken: String,
    val refreshToken: String,
)

/**
 * Talks to hive's `POST {internal-url}/oauth2/token` (`client_secret_post`; research D1):
 * [exchange] redeems an authorization code (Authorization-Code + PKCE, from the login controller in
 * T009), [refresh] renews a session with the rotating refresh token (from
 * [no.rauboti.pokedex.config.SessionTokenAuthenticationFilter], T008). Both return the new
 * [HiveTokens]. Any transport failure or unusable response is surfaced as
 * [no.rauboti.pokedex.common.HiveUnavailableException] — the "hive unreachable" path; for a refresh
 * it also signals the session can no longer be renewed silently (fall back to login).
 *
 * Interface-only seam: the [SessionTokenAuthenticationFilter][no.rauboti.pokedex.config.SessionTokenAuthenticationFilter]
 * compiles against this now (T008); the production RestClient implementation lands with the auth BFF (T009).
 */
interface HiveTokenClient {
    fun exchange(
        code: String,
        codeVerifier: String,
        redirectUri: String,
    ): HiveTokens

    fun refresh(refreshToken: String): HiveTokens
}
