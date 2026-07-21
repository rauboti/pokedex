package no.rauboti.pokedex.config

import com.nimbusds.jose.jwk.JWKSet
import com.nimbusds.jose.jwk.RSAKey
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator
import com.nimbusds.jose.jwk.source.ImmutableJWKSet
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm
import org.springframework.security.oauth2.jwt.JwsHeader
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.jwt.JwtClaimsSet
import org.springframework.security.oauth2.jwt.JwtEncoderParameters
import org.springframework.security.oauth2.jwt.JwtValidationException
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.UUID

/**
 * The consumer contract from pokedex's side (research D1), proven with only public inputs: a token
 * signed by an RS256 key whose public half is the "JWKS", validated by the *production* decoder
 * validators (iss/aud/exp) and authorities converter. Mirrors avec's `JwtValidationTest`, with
 * `aud=pokedex` — the aud check is what scopes hive's flat `roles` claim to pokedex (avec T006
 * discovery); pokedex mints its own token here since it is the consumer, not the issuer.
 *
 * These are the checks the full-context `SecurityConfigTest` cannot cover — there the `jwt()`
 * post-processor injects a ready-made authentication and bypasses the real decoder/validators. No
 * Spring context / DB needed: this exercises the JWT wiring in isolation.
 */
class JwtValidationTest {
    private val issuer = "https://hive.test"

    // The signing key; its public half stands in for hive's JWKS.
    private val rsaKey: RSAKey = RSAKeyGenerator(2048).keyID("test-kid").generate()
    private val encoder = NimbusJwtEncoder(ImmutableJWKSet(JWKSet(rsaKey)))

    // The production decoder, pointed at the local public key instead of a JWKS URL, carrying the
    // real pokedex validators (iss == issuer, aud contains pokedex, exp).
    private val decoder =
        NimbusJwtDecoder
            .withPublicKey(rsaKey.toRSAPublicKey())
            .signatureAlgorithm(SignatureAlgorithm.RS256)
            .build()
            .apply { setJwtValidator(pokedexJwtValidator(issuer)) }

    private fun mint(
        iss: String = issuer,
        audience: List<String> = listOf(POKEDEX_AUDIENCE),
        expiresAt: Instant = Instant.now().plus(5, ChronoUnit.MINUTES),
        roles: List<String>? = listOf("user"),
    ): String {
        val header = JwsHeader.with(SignatureAlgorithm.RS256).keyId(rsaKey.keyID).build()
        val claims =
            JwtClaimsSet
                .builder()
                .issuer(iss)
                .subject(UUID.randomUUID().toString())
                .audience(audience)
                // Always before expiry (Jwt requires exp > iat), and in the past.
                .issuedAt(expiresAt.minus(30, ChronoUnit.MINUTES))
                .expiresAt(expiresAt)
                .apply { roles?.let { claim("roles", it) } }
                .build()
        return encoder.encode(JwtEncoderParameters.from(header, claims)).tokenValue
    }

    @Test
    fun `a valid hive token is accepted and its role keys map to ROLE_ authorities`() {
        val jwt: Jwt = decoder.decode(mint(roles = listOf("admin", "user")))

        assertThat(jwt.issuer.toString()).isEqualTo(issuer)
        val authorities = PokedexJwtAuthoritiesConverter().convert(jwt).map { it.authority }
        assertThat(authorities).containsExactlyInAnyOrder("ROLE_admin", "ROLE_user")
    }

    @Test
    fun `a token whose audience excludes pokedex is rejected`() {
        assertThatThrownBy { decoder.decode(mint(audience = listOf("some-other-app"))) }
            .isInstanceOf(JwtValidationException::class.java)
    }

    @Test
    fun `a token from a different issuer is rejected`() {
        assertThatThrownBy { decoder.decode(mint(iss = "https://evil.test")) }
            .isInstanceOf(JwtValidationException::class.java)
    }

    @Test
    fun `an expired token is rejected`() {
        // Well past the JwtTimestampValidator's default 60s clock-skew allowance.
        assertThatThrownBy { decoder.decode(mint(expiresAt = Instant.now().minus(5, ChronoUnit.MINUTES))) }
            .isInstanceOf(JwtValidationException::class.java)
    }

    @Test
    fun `a token with an empty roles list yields no authorities (no pokedex access)`() {
        // Hive issues aud=[pokedex] with empty roles when the user has no pokedex grant.
        val jwt = decoder.decode(mint(roles = emptyList()))
        assertThat(PokedexJwtAuthoritiesConverter().convert(jwt)).isEmpty()
    }

    @Test
    fun `a token with no roles claim at all yields no authorities`() {
        val jwt = decoder.decode(mint(roles = null))
        assertThat(PokedexJwtAuthoritiesConverter().convert(jwt)).isEmpty()
    }
}
