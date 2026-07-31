package no.rauboti.pokedex.auth

/**
 * The `GET /api/auth/me` response, straight from the hive token's claims. An empty `roles` list means
 * a signed-in hive user with no pokedex grant — the SPA shows its no-access screen.
 */
data class AuthenticatedUser(
    val sub: String,
    val name: String?,
    val roles: List<String>,
)
