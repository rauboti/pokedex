package no.rauboti.pokedex.config

/**
 * Hive's OAuth/OIDC endpoint paths — fixed by hive's contract, so they live here as constants rather
 * than as configuration (only the base URLs are configured). Combined with the two bases they form
 * the full endpoints:
 *  - authorize: `{external-url}` + [AUTHORIZE_PATH] — the browser is redirected here (T009)
 *  - token:     `{internal-url}` + [TOKEN_PATH]     — server-side exchange from the api container (T009)
 *  - JWKS:      `{internal-url}` + [JWKS_PATH]      — server-side key fetch for JWT validation (T008)
 */
object HiveEndpoints {
    const val AUTHORIZE_PATH = "/oauth2/authorize"
    const val TOKEN_PATH = "/oauth2/token"
    const val JWKS_PATH = "/.well-known/jwks.json"
}
