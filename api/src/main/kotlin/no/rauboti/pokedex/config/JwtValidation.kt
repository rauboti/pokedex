package no.rauboti.pokedex.config

import org.springframework.core.convert.converter.Converter
import org.springframework.security.core.GrantedAuthority
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator
import org.springframework.security.oauth2.core.OAuth2Error
import org.springframework.security.oauth2.core.OAuth2TokenValidator
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.jwt.JwtValidators

/** pokedex's own app slug — the audience its hive tokens must carry (research D1). */
const val POKEDEX_AUDIENCE = "pokedex"

/**
 * Validators for a hive-issued JWT, from pokedex's perspective (research D1): the Spring defaults
 * (`exp`/`nbf` timestamps) plus `iss == HIVE_EXTERNAL_URL`, and an `aud` that contains `pokedex`.
 * Signature verification against the JWKS is the decoder's job; these are the claim checks layered
 * on top.
 */
fun pokedexJwtValidator(issuer: String): OAuth2TokenValidator<Jwt> =
    DelegatingOAuth2TokenValidator(
        JwtValidators.createDefaultWithIssuer(issuer),
        audienceValidator(),
    )

/** Fails unless the token's `aud` contains pokedex's own slug (research D1). */
private fun audienceValidator(): OAuth2TokenValidator<Jwt> =
    OAuth2TokenValidator { jwt ->
        if (POKEDEX_AUDIENCE in jwt.audience.orEmpty()) {
            OAuth2TokenValidatorResult.success()
        } else {
            OAuth2TokenValidatorResult.failure(
                OAuth2Error("invalid_token", "Required audience '$POKEDEX_AUDIENCE' is missing", null),
            )
        }
    }

/**
 * Maps the token's `roles` claim to Spring's `ROLE_` convention, so endpoints can use
 * `hasRole("user")` / `hasRole("admin")` (mirrors avec). Hive scopes each token to a single app,
 * so `roles` is a flat list of the keys the user holds in pokedex (the `aud` — already checked by
 * [pokedexJwtValidator] — identifies the app). Both roles clear the data API; by convention hive
 * grants an admin both (`roles=[admin, user]`), but an admin-only token must clear the chain too
 * (admin additionally unlocks the admin-only catalog sync, gated per-endpoint in T010). A hive
 * account without a pokedex grant gets an empty (or absent) list → no authorities → 403 on the data
 * API.
 */
class PokedexJwtAuthoritiesConverter : Converter<Jwt, Collection<GrantedAuthority>> {
    override fun convert(jwt: Jwt): Collection<GrantedAuthority> =
        (jwt.getClaimAsStringList("roles") ?: emptyList()).map { SimpleGrantedAuthority("ROLE_$it") }
}
