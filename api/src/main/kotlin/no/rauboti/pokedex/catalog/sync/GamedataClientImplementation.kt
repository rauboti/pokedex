package no.rauboti.pokedex.catalog.sync

import no.rauboti.pokedex.common.GamedataUnavailableException
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpHeaders
import org.springframework.http.client.SimpleClientHttpRequestFactory
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientException
import java.time.Duration

/**
 * Fetches the raw game-data feed. Split behind an interface so the sync is tested with a MockK stub at
 * this boundary rather than an HTTP-level mock; parsing is [GamedataNormalizer]'s job.
 */
@Component
class GamedataClientImplementation(
    @Value("\${pokedex.gamedata.base-url}") baseUrl: String,
) : GamedataClient {
    private val restClient =
        RestClient
            .builder()
            .baseUrl(baseUrl)
            .defaultHeader(HttpHeaders.USER_AGENT, USER_AGENT)
            .requestFactory(
                SimpleClientHttpRequestFactory().apply {
                    setConnectTimeout(Duration.ofSeconds(5))
                    // Generous: the full feed is large. Still bounds a hung fetch.
                    setReadTimeout(Duration.ofSeconds(30))
                },
            ).build()

    override fun fetchPokedex(): String =
        try {
            restClient
                .get()
                .uri(POKEDEX_PATH)
                .retrieve()
                .body(String::class.java)
        } catch (e: RestClientException) {
            throw GamedataUnavailableException("gamedata-unavailable", "Game-data source request failed", e)
        } ?: throw GamedataUnavailableException("gamedata-unavailable", "Empty response from game-data source")

    companion object {
        private const val POKEDEX_PATH = "/api/pokedex.json"
        private const val USER_AGENT = "pokedex-api (github.com/rauboti/pokedex)"
    }
}
