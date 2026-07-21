package no.rauboti.pokedex.config

import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.HttpStatus
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity
import org.springframework.security.config.http.SessionCreationPolicy
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.web.access.intercept.AuthorizationFilter
import org.springframework.security.web.authentication.HttpStatusEntryPoint
import org.springframework.web.cors.CorsConfiguration
import org.springframework.web.cors.CorsConfigurationSource
import org.springframework.web.cors.UrlBasedCorsConfigurationSource

/**
 * Security for the BFF (research D1). pokedex is a *consumer* of hive: it validates hive-issued RS256
 * JWTs offline via hive's JWKS. The browser holds only a session cookie — the token lives
 * server-side in the session — so API requests are authenticated by [SessionTokenAuthenticationFilter],
 * which decodes that token (same [JwtDecoder]/validators and authorities converter a resource server
 * would use) and silently refreshes it on expiry.
 *
 * The `SecurityContext` itself is stateless (rebuilt per request from the session token, never
 * persisted). URL model (mirrors avec): the `/auth` endpoints are the **public, browser-redirect**
 * OAuth handshake (login/callback — they *start* a session, so need none); the `/api/auth` endpoints
 * are the **authenticated SPA fetch** calls (`me`, `logout`), needing only a valid session so a hive
 * user *without* a pokedex grant can still see they're signed in and sign out. The rest of the data
 * API additionally requires a pokedex app role (`user` or `admin`) — a signed-in user with no pokedex
 * grant gets a 403 there; the admin-only catalog sync is gated per-endpoint (T010). The actuator
 * health probe is public (compose healthcheck). Unauthenticated calls answer with a plain 401 (no
 * redirect), which the SPA turns into a hive login. CORS is driven by `pokedex.cors.allowed-origins`.
 * Session-cookie hardening (HttpOnly, SameSite=Lax, Secure via `SESSION_COOKIE_SECURE`) is declared
 * in application.yml.
 */
@Configuration
@EnableWebSecurity
class SecurityConfig(
    // Browser-reachable hive base — also the token issuer (`iss`): hive stamps its external URL,
    // so this is what the iss validator expects.
    @param:Value("\${pokedex.hive.external-url}") private val externalUrl: String,
    // Container-reachable hive base — the JWKS endpoint is derived from it (server-side fetch).
    @param:Value("\${pokedex.hive.internal-url}") private val internalUrl: String,
    @param:Value("\${pokedex.cors.allowed-origins}") private val corsAllowedOrigins: List<String>,
) {
    /**
     * Decoder pointed at hive's JWKS URI (`internal-url` + JWKS path; keys fetched + cached lazily on
     * first use, so no network call at startup), carrying pokedex's claim validators — `iss` is
     * validated against the external URL hive stamps into its tokens.
     */
    @Bean
    fun jwtDecoder(): JwtDecoder =
        NimbusJwtDecoder
            .withJwkSetUri("$internalUrl${HiveEndpoints.JWKS_PATH}")
            .build()
            .apply { setJwtValidator(pokedexJwtValidator(externalUrl)) }

    @Bean
    fun jwtAuthenticationConverter(): JwtAuthenticationConverter =
        JwtAuthenticationConverter().apply {
            setJwtGrantedAuthoritiesConverter(PokedexJwtAuthoritiesConverter())
        }

    @Bean
    fun securityFilterChain(
        http: HttpSecurity,
        sessionTokenAuthenticationFilter: SessionTokenAuthenticationFilter,
    ): SecurityFilterChain {
        http
            .cors { it.configurationSource(corsConfigurationSource()) }
            // Stateless API secured by a same-site session cookie: no CSRF token flow (research D1).
            .csrf { it.disable() }
            .sessionManagement { it.sessionCreationPolicy(SessionCreationPolicy.STATELESS) }
            .authorizeHttpRequests {
                it.requestMatchers("/actuator/health", "/actuator/health/**").permitAll()
                // Public: the browser-redirect OAuth handshake starts a session, it doesn't need one.
                it.requestMatchers("/auth/login", "/auth/callback").permitAll()
                // SPA fetch endpoints: any signed-in hive user may read their identity or sign out,
                // even without a pokedex grant (so the SPA can show the no-access screen and a sign-out).
                it.requestMatchers("/api/auth/**").authenticated()
                // The data API is gated on holding a pokedex app role (user or admin).
                it.requestMatchers("/api/**").hasAnyRole("user", "admin")
                it.anyRequest().authenticated()
            }.exceptionHandling {
                // Unauthenticated API call → plain 401 (no redirect); the SPA starts a hive login.
                it.authenticationEntryPoint(HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED))
            }.addFilterBefore(sessionTokenAuthenticationFilter, AuthorizationFilter::class.java)
        return http.build()
    }

    private fun corsConfigurationSource(): CorsConfigurationSource {
        val config =
            CorsConfiguration().apply {
                allowedOrigins = corsAllowedOrigins
                allowedMethods = listOf("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                allowedHeaders = listOf("*")
                allowCredentials = true
            }
        return UrlBasedCorsConfigurationSource().apply { registerCorsConfiguration("/**", config) }
    }
}
