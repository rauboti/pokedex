package no.rauboti.pokedex.config

import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.HttpMethod
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
 * Security for the BFF. See the api README's "Auth model" for the URL model and role rules;
 * session-cookie hardening is declared in application.yml.
 */
@Configuration
@EnableWebSecurity
class SecurityConfig(
    // Also the expected token `iss` — hive stamps its external URL into what it issues.
    @param:Value("\${pokedex.hive.external-url}") private val externalUrl: String,
    @param:Value("\${pokedex.hive.internal-url}") private val internalUrl: String,
    @param:Value("\${pokedex.cors.allowed-origins}") private val corsAllowedOrigins: List<String>,
) {
    /** Keys are fetched and cached lazily on first use, so there is no network call at startup. */
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
            // Stateless API behind a same-site session cookie: no CSRF token flow (research D1).
            .csrf { it.disable() }
            .sessionManagement { it.sessionCreationPolicy(SessionCreationPolicy.STATELESS) }
            .authorizeHttpRequests {
                it.requestMatchers("/actuator/health", "/actuator/health/**").permitAll()
                it.requestMatchers("/auth/login", "/auth/callback").permitAll()
                it.requestMatchers("/api/auth/**").authenticated()
                // Must precede the /api/** rule below — more specific matchers win only if first.
                it.requestMatchers(HttpMethod.POST, "/api/catalog/sync").hasRole("admin")
                it.requestMatchers("/api/**").hasAnyRole("user", "admin")
                it.anyRequest().authenticated()
            }.exceptionHandling {
                // Plain 401, no redirect — the SPA turns it into a hive login.
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
