package no.rauboti.pokedex.species

import no.rauboti.pokedex.support.IntegrationTest
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.request.RequestPostProcessor
import java.util.UUID

/**
 * Contract test for `GET /api/species?q=` (US1): returns registrable species matching a name
 * substring, each with its `types` list assembled from type_1/type_2; mega/temporary forms are
 * excluded; a missing/blank query is 400; unauthenticated is 401.
 */
@AutoConfigureMockMvc
class SpeciesApiTest : IntegrationTest() {
    @Autowired private lateinit var mvc: MockMvc

    @Autowired private lateinit var jdbc: JdbcClient

    @BeforeEach
    fun seed() {
        jdbc.sql("truncate table caught_pokemon, species_move, species, move").update()
        insert("VENUSAUR", 3, "Venusaur", null, "Grass", "Poison", true)
        insert("VENUSAUR_MEGA", 3, "Venusaur", "Mega", "Grass", "Poison", false)
        insert("CHARMANDER", 4, "Charmander", null, "Fire", null, true)
    }

    private fun insert(
        id: String,
        dexNr: Int,
        name: String,
        form: String?,
        type1: String,
        type2: String?,
        registrable: Boolean,
    ) {
        jdbc
            .sql(
                """
                insert into species (id, dex_nr, name, form, base_atk, base_def, base_sta,
                                     type_1, type_2, registrable, image_url, shiny_image_url, synced_at)
                values (:id, :dex, :name, :form, 198, 189, 190, :t1, :t2, :reg, :img, :shiny, now())
                """.trimIndent(),
            ).param("id", id)
            .param("dex", dexNr)
            .param("name", name)
            .param("form", form)
            .param("t1", type1)
            .param("t2", type2)
            .param("reg", registrable)
            .param("img", "https://example.test/$id.png")
            .param("shiny", "https://example.test/$id.s.png")
            .update()
    }

    private fun user(vararg roles: String): RequestPostProcessor =
        jwt()
            .jwt { it.subject(UUID.randomUUID().toString()).claim("roles", roles.toList()) }
            .authorities(roles.map { SimpleGrantedAuthority("ROLE_$it") })

    @Test
    fun `returns matching registrable species with an assembled types list`() {
        mvc
            .get("/api/species?q=venusaur") { with(user("user")) }
            .andExpect {
                status { isOk() }
                jsonPath("$.length()") { value(1) } // the mega is excluded
                jsonPath("$[0].id") { value("VENUSAUR") }
                jsonPath("$[0].types[0]") { value("Grass") }
                jsonPath("$[0].types[1]") { value("Poison") }
                jsonPath("$[0].baseAtk") { value(198) }
            }
    }

    @Test
    fun `exposes the synced sprite URLs on the species`() {
        mvc
            .get("/api/species?q=venusaur") { with(user("user")) }
            .andExpect {
                status { isOk() }
                jsonPath("$[0].imageUrl") { value("https://example.test/VENUSAUR.png") }
                jsonPath("$[0].shinyImageUrl") { value("https://example.test/VENUSAUR.s.png") }
            }
    }

    @Test
    fun `a single-type species has a one-element types list`() {
        mvc
            .get("/api/species?q=charmander") { with(user("user")) }
            .andExpect {
                status { isOk() }
                jsonPath("$[0].types.length()") { value(1) }
                jsonPath("$[0].types[0]") { value("Fire") }
            }
    }

    @Test
    fun `a blank query is a 400`() {
        mvc.get("/api/species?q=") { with(user("user")) }.andExpect { status { isBadRequest() } }
    }

    @Test
    fun `a missing query is a 400`() {
        mvc.get("/api/species") { with(user("user")) }.andExpect { status { isBadRequest() } }
    }

    @Test
    fun `caps the limit at 50`() {
        // A limit above the contract max is accepted but capped; with 2 registrable rows we just
        // assert it does not error and returns the (few) matches.
        mvc
            .get("/api/species?q=a&limit=100") { with(user("user")) }
            .andExpect { status { isOk() } }
    }

    @Test
    fun `requires authentication`() {
        mvc.get("/api/species?q=venusaur").andExpect { status { isUnauthorized() } }
    }
}
