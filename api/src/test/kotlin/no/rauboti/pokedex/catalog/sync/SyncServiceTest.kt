package no.rauboti.pokedex.catalog.sync

import io.mockk.every
import io.mockk.mockk
import no.rauboti.pokedex.common.GamedataUnavailableException
import no.rauboti.pokedex.move.MoveRepository
import no.rauboti.pokedex.species.SpeciesRepository
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

    @Autowired private lateinit var moveRepository: MoveRepository

    @Autowired private lateinit var speciesRepository: SpeciesRepository

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

    private fun imageUrlOf(id: String): String? =
        jdbc
            .sql("select image_url from species where id = :id")
            .param("id", id)
            .query(String::class.java)
            .optional()
            .orElse(null)

    private fun rarityOf(id: String): String? =
        jdbc
            .sql("select rarity from species where id = :id")
            .param("id", id)
            .query(String::class.java)
            .optional()
            .orElse(null)

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

        assertThat(speciesRepository.count()).isEqualTo(5) // VENUSAUR(+mega), RATTATA(+alola), CHARMANDER
        assertThat(moveRepository.count()).isEqualTo(11)
        assertThat(speciesRepository.lastSyncedAt()).isNotNull()
        assertThat(poolMoveIds("VENUSAUR"))
            .containsExactlyInAnyOrder("RAZOR_LEAF_FAST", "VINE_WHIP_FAST", "SLUDGE_BOMB", "POWER_WHIP", "FRENZY_PLANT")
        // Sprite URLs from the feed's `assets` block are persisted by the upsert (research D5).
        assertThat(imageUrlOf("VENUSAUR")).isEqualTo("https://example.test/assets/Pokemon/pm3.icon.png")
        // The feed's pokemonClass is persisted as a rarity label; null for an ordinary species.
        assertThat(rarityOf("VENUSAUR")).isEqualTo("Legendary")
        assertThat(rarityOf("RATTATA")).isNull()
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
        assertThat(speciesRepository.count()).isEqualTo(5)
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
        val before = speciesRepository.count()

        every { gamedataClient.fetchPokedex() } throws
            GamedataUnavailableException("gamedata-unavailable", "source down")

        assertThatThrownBy { syncService.sync() }
            .isInstanceOf(GamedataUnavailableException::class.java)
        assertThat(speciesRepository.count()).isEqualTo(before)
    }
}
