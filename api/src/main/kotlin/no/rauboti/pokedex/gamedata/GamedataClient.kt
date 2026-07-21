package no.rauboti.pokedex.gamedata

import no.rauboti.pokedex.common.GamedataUnavailableException
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpHeaders
import org.springframework.http.client.SimpleClientHttpRequestFactory
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientException
import java.time.Duration

/**
 * Fetches the raw game-data feed from the community source (research D5). Interface so [SyncService]
 * can be tested with a MockK stub at this boundary — no HTTP-level mock, matching every sibling app
 * (research D5 amendment). Any transport failure or unusable response is surfaced as
 * [GamedataUnavailableException] (→ 502); parsing/normalization is [GamedataNormalizer]'s job.
 */
interface GamedataClient {
    /** The full Pokédex feed as raw JSON (a JSON array of species objects). */
    fun fetchPokedex(): String
}

@Component
class RestClientGamedataClient(
    @Value("\${pokedex.gamedata.base-url}") baseUrl: String,
) : GamedataClient {
    private val restClient =
        RestClient
            .builder()
            .baseUrl(baseUrl)
            // Identify ourselves to the static host (courtesy + easier debugging of any rate-limiting).
            .defaultHeader(HttpHeaders.USER_AGENT, USER_AGENT)
            .requestFactory(
                SimpleClientHttpRequestFactory().apply {
                    setConnectTimeout(Duration.ofSeconds(5))
                    // The full feed is large but static; a generous read timeout still bounds a hung fetch.
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
