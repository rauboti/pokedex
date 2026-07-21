package no.rauboti.pokedex.gamedata

import io.mockk.every
import io.mockk.mockk
import no.rauboti.pokedex.common.GamedataUnavailableException
import no.rauboti.pokedex.support.IntegrationTest
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Import
import org.springframework.context.annotation.Primary
import org.springframework.jdbc.core.simple.JdbcClient

/**
 * The catalog sync against a real Postgres (Testcontainers), with the external [GamedataClient]
 * stubbed at the interface level with MockK (research D5 amendment — no HTTP-level mock): a full sync
 * upserts species/move/species_move with `synced_at`; a re-sync updates changed base stats in place
 * and replaces a species' pool without deleting species rows; a client failure surfaces
 * [GamedataUnavailableException] and leaves the catalog untouched.
 */
@Import(SyncServiceTest.StubGamedataClient::class)
class SyncServiceTest : IntegrationTest() {
    @TestConfiguration(proxyBeanMethods = false)
    class StubGamedataClient {
        @Bean
        @Primary
        fun gamedataClient(): GamedataClient = mockk()
    }

    @Autowired private lateinit var syncService: SyncService

    @Autowired private lateinit var catalog: CatalogRepository

    @Autowired private lateinit var gamedataClient: GamedataClient

    @Autowired private lateinit var jdbc: JdbcClient

    private val fixture: String =
        checkNotNull(javaClass.getResource("/gamedata/pokedex-fixture.json")).readText()

    @BeforeEach
    fun clean() {
        jdbc.sql("truncate table caught_pokemon, species_move, species, move").update()
    }

    private fun baseAtkOf(id: String): Int =
        jdbc
            .sql("select base_atk from species where id = :id")
            .param("id", id)
            .query(Int::class.java)
            .single()

    private fun poolMoveIds(speciesId: String): List<String> =
        jdbc
            .sql("select move_id from species_move where species_id = :sid")
            .param("sid", speciesId)
            .query(String::class.java)
            .list()
            .filterNotNull()

    @Test
    fun `a full sync upserts species, moves and pools with a synced_at timestamp`() {
        every { gamedataClient.fetchPokedex() } returns fixture

        syncService.sync()

        assertThat(catalog.speciesCount()).isEqualTo(5) // VENUSAUR(+mega), RATTATA(+alola), CHARMANDER
        assertThat(catalog.moveCount()).isEqualTo(11)
        assertThat(catalog.lastSyncedAt()).isNotNull()
        assertThat(poolMoveIds("VENUSAUR"))
            .containsExactlyInAnyOrder("RAZOR_LEAF_FAST", "VINE_WHIP_FAST", "SLUDGE_BOMB", "POWER_WHIP", "FRENZY_PLANT")
    }

    @Test
    fun `a re-sync updates changed base stats in place and never deletes species rows`() {
        every { gamedataClient.fetchPokedex() } returns fixture
        syncService.sync()

        // A later feed carrying only Venusaur with a rebalanced attack; RATTATA/CHARMANDER absent.
        val rebalanced =
            """
            [
              {
                "id": "VENUSAUR", "dexNr": 3, "names": { "English": "Venusaur" },
                "stats": { "stamina": 190, "attack": 210, "defense": 189 },
                "primaryType": { "type": "POKEMON_TYPE_GRASS" },
                "secondaryType": { "type": "POKEMON_TYPE_POISON" },
                "quickMoves": {}, "cinematicMoves": {}, "eliteQuickMoves": [], "eliteCinematicMoves": {},
                "regionForms": [], "megaEvolutions": {}
              }
            ]
            """.trimIndent()
        every { gamedataClient.fetchPokedex() } returns rebalanced

        syncService.sync()

        assertThat(baseAtkOf("VENUSAUR")).isEqualTo(210) // updated in place
        // Species absent from the second feed are NOT deleted (existing collections stay valid).
        assertThat(catalog.speciesCount()).isEqualTo(5)
    }

    @Test
    fun `a re-sync replaces a species pool rather than accumulating`() {
        every { gamedataClient.fetchPokedex() } returns fixture
        syncService.sync()
        assertThat(poolMoveIds("CHARMANDER")).containsExactlyInAnyOrder("SCRATCH_FAST", "FLAME_CHARGE")

        val narrowed =
            """
            [
              {
                "id": "CHARMANDER", "dexNr": 4, "names": { "English": "Charmander" },
                "stats": { "stamina": 118, "attack": 116, "defense": 93 },
                "primaryType": { "type": "POKEMON_TYPE_FIRE" }, "secondaryType": null,
                "quickMoves": {
                  "EMBER_FAST": {
                    "id": "EMBER_FAST", "power": 10, "energy": 10, "durationMs": 1000,
                    "type": { "type": "POKEMON_TYPE_FIRE" }, "names": { "English": "Ember" }
                  }
                },
                "cinematicMoves": {}, "eliteQuickMoves": [], "eliteCinematicMoves": {},
                "regionForms": [], "megaEvolutions": {}
              }
            ]
            """.trimIndent()
        every { gamedataClient.fetchPokedex() } returns narrowed

        syncService.sync()

        assertThat(poolMoveIds("CHARMANDER")).containsExactly("EMBER_FAST")
    }

    @Test
    fun `a client failure surfaces GamedataUnavailableException and leaves the catalog unchanged`() {
        every { gamedataClient.fetchPokedex() } returns fixture
        syncService.sync()
        val before = catalog.speciesCount()

        every { gamedataClient.fetchPokedex() } throws
            GamedataUnavailableException("gamedata-unavailable", "source down")

        assertThatThrownBy { syncService.sync() }
            .isInstanceOf(GamedataUnavailableException::class.java)
        assertThat(catalog.speciesCount()).isEqualTo(before)
    }
}
