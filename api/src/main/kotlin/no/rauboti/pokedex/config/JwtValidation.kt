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

/** pokedex's own app slug — the audience its hive tokens must carry. */
const val POKEDEX_AUDIENCE = "pokedex"

/**
 * Claim checks on a hive-issued JWT: Spring's defaults (`exp`/`nbf`) plus `iss` and `aud`.
 * Signature verification against the JWKS is the decoder's job.
 */
fun pokedexJwtValidator(issuer: String): OAuth2TokenValidator<Jwt> =
    DelegatingOAuth2TokenValidator(
        JwtValidators.createDefaultWithIssuer(issuer),
        audienceValidator(),
    )

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
 * Maps the token's `roles` claim onto Spring's `ROLE_` convention. hive scopes each token to one app
 * (the already-validated `aud`), so `roles` is a flat list of the keys the user holds in pokedex —
 * no grant means no authorities, hence a 403 on the data API.
 */
class PokedexJwtAuthoritiesConverter : Converter<Jwt, Collection<GrantedAuthority>> {
    override fun convert(jwt: Jwt): Collection<GrantedAuthority> =
        (jwt.getClaimAsStringList("roles") ?: emptyList()).map { SimpleGrantedAuthority("ROLE_$it") }
}
