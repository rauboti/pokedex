package no.rauboti.pokedex.config

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import jakarta.servlet.http.HttpSession
import no.rauboti.pokedex.auth.HiveTokenClient
import no.rauboti.pokedex.auth.SessionKeys
import org.springframework.security.authentication.AnonymousAuthenticationToken
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.security.oauth2.jwt.JwtException
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter

/**
 * Authenticates API requests from the session-stored hive access token, rebuilding the
 * `SecurityContext` per request and refreshing the token silently on expiry. See the api README's
 * "Auth model".
 */
@Component
class SessionTokenAuthenticationFilter(
    private val jwtDecoder: JwtDecoder,
    private val jwtAuthenticationConverter: JwtAuthenticationConverter,
    private val hiveTokenClient: HiveTokenClient,
) : OncePerRequestFilter() {
    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain,
    ) {
        val session = request.getSession(false)
        val accessToken = session?.getAttribute(SessionKeys.ACCESS_TOKEN) as? String
        // AnonymousAuthenticationFilter runs before this one, so the context already holds a non-null
        // anonymous token. Treat that as "not yet authenticated" or every request stays anonymous → 401.
        val existing = SecurityContextHolder.getContext().authentication
        if (accessToken != null && (existing == null || existing is AnonymousAuthenticationToken)) {
            validAccessJwt(accessToken, session)?.let { jwt ->
                SecurityContextHolder.getContext().authentication = jwtAuthenticationConverter.convert(jwt)
            }
        }
        filterChain.doFilter(request, response)
    }

    /** Decode the stored access token, silently refreshing it once if it no longer validates. */
    private fun validAccessJwt(
        accessToken: String,
        session: HttpSession,
    ): Jwt? =
        try {
            jwtDecoder.decode(accessToken)
        } catch (expiredOrInvalid: JwtException) {
            refreshAndDecode(session)
        }

    private fun refreshAndDecode(session: HttpSession): Jwt? {
        val refreshToken = session.getAttribute(SessionKeys.REFRESH_TOKEN) as? String ?: return null
        return try {
            val tokens = hiveTokenClient.refresh(refreshToken)
            session.setAttribute(SessionKeys.ACCESS_TOKEN, tokens.accessToken)
            session.setAttribute(SessionKeys.REFRESH_TOKEN, tokens.refreshToken)
            jwtDecoder.decode(tokens.accessToken)
        } catch (refreshFailed: RuntimeException) {
            // Unrenewable session — drop the dead tokens so the request is unauthenticated (401).
            session.removeAttribute(SessionKeys.ACCESS_TOKEN)
            session.removeAttribute(SessionKeys.REFRESH_TOKEN)
            null
        }
    }
}
