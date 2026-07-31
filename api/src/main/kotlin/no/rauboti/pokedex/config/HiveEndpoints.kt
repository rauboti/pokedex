package no.rauboti.pokedex.config

/**
 * hive's OAuth endpoint paths — fixed by its contract, so constants rather than configuration.
 * Authorize hangs off the external base; token and JWKS off the internal one.
 */
object HiveEndpoints {
    const val AUTHORIZE_PATH = "/oauth2/authorize"
    const val TOKEN_PATH = "/oauth2/token"
    const val JWKS_PATH = "/.well-known/jwks.json"
}
