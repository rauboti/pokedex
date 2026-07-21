package no.rauboti.pokedex.auth

/**
 * The authenticated player as the SPA needs it — the `GET /api/auth/me` response (contract schema
 * `Me`). All fields come from the hive access token's claims: `sub` is the hive subject (the stable
 * user id the data API scopes every row by), `name` the display name, and `roles` the flat
 * aud-scoped list of pokedex role keys the user holds. An empty `roles` list is a signed-in hive
 * user with no pokedex grant — the SPA shows its no-access screen, while the data API answers 403
 * server-side regardless.
 */
data class AuthenticatedUser(
    val sub: String,
    val name: String?,
    val roles: List<String>,
)
