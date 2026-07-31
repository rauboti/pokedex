package no.rauboti.pokedex.auth

import no.rauboti.pokedex.common.HiveUnavailableException
import no.rauboti.pokedex.config.HiveEndpoints
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.util.LinkedMultiValueMap
import org.springframework.util.MultiValueMap
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientException

/** The short-lived access token and the rotating refresh token. */
data class HiveTokens(
    val accessToken: String,
    val refreshToken: String,
)

/**
 * hive's token endpoint (`client_secret_post`). Any transport failure or unusable response becomes a
 * `HiveUnavailableException`; on a refresh that also means the session can't be renewed silently.
 */
interface HiveTokenClient {
    fun exchange(
        code: String,
        codeVerifier: String,
        redirectUri: String,
    ): HiveTokens

    fun refresh(refreshToken: String): HiveTokens
}

@Component
class RestClientHiveTokenClient(
    @Value("\${pokedex.hive.internal-url}") internalUrl: String,
    @param:Value("\${pokedex.hive.client-id}") private val clientId: String,
    @param:Value("\${pokedex.hive.client-secret}") private val clientSecret: String,
) : HiveTokenClient {
    private val restClient = RestClient.builder().baseUrl(internalUrl).build()

    override fun exchange(
        code: String,
        codeVerifier: String,
        redirectUri: String,
    ): HiveTokens =
        postToken(
            LinkedMultiValueMap<String, String>().apply {
                add("grant_type", "authorization_code")
                add("code", code)
                add("redirect_uri", redirectUri)
                add("code_verifier", codeVerifier)
            },
        )

    override fun refresh(refreshToken: String): HiveTokens =
        postToken(
            LinkedMultiValueMap<String, String>().apply {
                add("grant_type", "refresh_token")
                add("refresh_token", refreshToken)
            },
        )

    private fun postToken(form: MultiValueMap<String, String>): HiveTokens {
        form.add("client_id", clientId)
        form.add("client_secret", clientSecret)
        val body: Map<*, *> =
            try {
                restClient
                    .post()
                    .uri(HiveEndpoints.TOKEN_PATH)
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve()
                    .body(Map::class.java)
            } catch (e: RestClientException) {
                // Transport failure or non-2xx (e.g. invalid_grant on a dead refresh token).
                throw HiveUnavailableException("hive-unavailable", "Hive token request failed", e)
            } ?: throw HiveUnavailableException("hive-unavailable", "Empty response from hive token endpoint")

        val access =
            body["access_token"] as? String
                ?: throw HiveUnavailableException("hive-unavailable", "Hive token response missing access_token")
        val refresh =
            body["refresh_token"] as? String
                ?: throw HiveUnavailableException("hive-unavailable", "Hive token response missing refresh_token")
        return HiveTokens(access, refresh)
    }
}
