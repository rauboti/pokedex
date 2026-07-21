package no.rauboti.pokedex.gamedata

import io.mockk.every
import io.mockk.mockk
import no.rauboti.pokedex.pokemon.CaughtPokemonRepository
import no.rauboti.pokedex.pokemon.NewCaughtPokemon
import no.rauboti.pokedex.stats.CpmTable
import no.rauboti.pokedex.stats.StatFormulas
import no.rauboti.pokedex.support.IntegrationTest
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Import
import org.springframework.context.annotation.Primary
import org.springframework.http.MediaType
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.patch
import org.springframework.test.web.servlet.request.RequestPostProcessor
import java.util.UUID

/**
 * End-to-end proof of the post-sync staleness rescan (FR-013/SC-005, closing the T010 seam). Against a
 * real Postgres (Testcontainers) with the external [GamedataClient] MockK-stubbed: a registered
 * Pokémon whose species is rebalanced (its stored level no longer yields the recorded CP) is flagged
 * `stale=true` by the next successful sync; a caught Pokémon of an unchanged species is left untouched;
 * the caller-scoped `GET /api/catalog` stale count reflects it; and a re-deriving `PATCH` clears the
 * flag (PokemonService write invariant 3). The rescan only ever *sets* stale — a player's correction
 * is never undone by a later sync.
 */
@AutoConfigureMockMvc
@Import(StalenessRescanTest.StubGamedataClient::class)
class StalenessRescanTest : IntegrationTest() {
    @TestConfiguration(proxyBeanMethods = false)
    class StubGamedataClient {
        @Bean
        @Primary
        fun gamedataClient(): GamedataClient = mockk()
    }

    @Autowired private lateinit var mvc: MockMvc

    @Autowired private lateinit var syncService: SyncService

    @Autowired private lateinit var gamedataClient: GamedataClient

    @Autowired private lateinit var caught: CaughtPokemonRepository

    @Autowired private lateinit var jdbc: JdbcClient

    private val fixture: String =
        checkNotNull(javaClass.getResource("/gamedata/pokedex-fixture.json")).readText()

    // Venusaur/Charmander base stats as they appear in the committed fixture.
    private val venusaurCp = StatFormulas.cp(198, 189, 190, 15, 15, 15, CpmTable.cpm(40.0))
    private val charmanderCp = StatFormulas.cp(116, 93, 118, 15, 15, 15, CpmTable.cpm(20.0))

    private val ownerId = "11111111-1111-1111-1111-111111111111"

    @BeforeEach
    fun clean() {
        jdbc.sql("truncate table caught_pokemon, species_move, species, move").update()
    }

    private fun owner(vararg roles: String): RequestPostProcessor =
        jwt()
            .jwt { it.subject(ownerId).claim("roles", roles.toList()) }
            .authorities(roles.map { SimpleGrantedAuthority("ROLE_$it") })

    /** A Venusaur feed carrying only a rebalanced attack (198 → 260); Charmander is absent, so it is
     *  neither updated nor deleted — its caught row must stay consistent. */
    private val rebalanced =
        """
        [
          {
            "id": "VENUSAUR", "dexNr": 3, "names": { "English": "Venusaur" },
            "stats": { "stamina": 190, "attack": 260, "defense": 189 },
            "primaryType": { "type": "POKEMON_TYPE_GRASS" },
            "secondaryType": { "type": "POKEMON_TYPE_POISON" },
            "quickMoves": {}, "cinematicMoves": {}, "eliteQuickMoves": [], "eliteCinematicMoves": {},
            "regionForms": [], "megaEvolutions": {}
          }
        ]
        """.trimIndent()

    @Test
    fun `a rebalance flags the affected caught Pokemon stale and leaves the unaffected one alone`() {
        every { gamedataClient.fetchPokedex() } returns fixture
        syncService.sync()

        val venusaur = registerHundo("VENUSAUR", venusaurCp, 40.0)
        val charmander = registerHundo("CHARMANDER", charmanderCp, 20.0)

        every { gamedataClient.fetchPokedex() } returns rebalanced
        syncService.sync()

        assertThat(caught.findByIdAndUser(venusaur, ownerId)!!.stale).isTrue()
        assertThat(caught.findByIdAndUser(charmander, ownerId)!!.stale).isFalse()
    }

    @Test
    fun `the caller-scoped catalog stale count reflects the rescan`() {
        every { gamedataClient.fetchPokedex() } returns fixture
        syncService.sync()
        registerHundo("VENUSAUR", venusaurCp, 40.0)
        registerHundo("CHARMANDER", charmanderCp, 20.0)

        every { gamedataClient.fetchPokedex() } returns rebalanced
        syncService.sync()

        mvc
            .get("/api/catalog") { with(owner("user")) }
            .andExpect {
                status { isOk() }
                jsonPath("$.stalePokemonCount") { value(1) }
            }
    }

    @Test
    fun `a re-deriving PATCH clears the stale flag`() {
        every { gamedataClient.fetchPokedex() } returns fixture
        syncService.sync()
        val venusaur = registerHundo("VENUSAUR", venusaurCp, 40.0)

        every { gamedataClient.fetchPokedex() } returns rebalanced
        syncService.sync()
        assertThat(caught.findByIdAndUser(venusaur, ownerId)!!.stale).isTrue()

        // Re-enter the CP as it now reads on the rebalanced (attack 260) Venusaur — the derivation
        // succeeds and invariant 3 clears the flag.
        val correctedCp = StatFormulas.cp(260, 189, 190, 15, 15, 15, CpmTable.cpm(40.0))
        mvc
            .patch("/api/pokemon/$venusaur") {
                with(owner("user"))
                contentType = MediaType.APPLICATION_JSON
                content = """{"cp": $correctedCp}"""
            }.andExpect {
                status { isOk() }
                jsonPath("$.stale") { value(false) }
            }

        mvc
            .get("/api/catalog") { with(owner("user")) }
            .andExpect { jsonPath("$.stalePokemonCount") { value(0) } }
    }

    /** Register a 15/15/15 caught Pokémon for [ownerId] straight through the repository at a
     *  solver-consistent (cp, level) pair, returning its generated id. */
    private fun registerHundo(
        speciesId: String,
        cp: Int,
        level: Double,
    ): UUID =
        caught
            .insert(
                NewCaughtPokemon(
                    userId = ownerId,
                    speciesId = speciesId,
                    ivAtk = 15,
                    ivDef = 15,
                    ivSta = 15,
                    cp = cp,
                    level = level,
                ),
            ).id
}
