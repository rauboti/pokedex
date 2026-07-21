package no.rauboti.pokedex.pokemon

import no.rauboti.pokedex.support.IntegrationTest
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.delete
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.patch
import org.springframework.test.web.servlet.post
import org.springframework.test.web.servlet.request.RequestPostProcessor
import java.util.UUID

/**
 * `PATCH /api/pokemon/{id}` and `DELETE /api/pokemon/{id}` (US1/FR-010): partial edits re-derive the
 * level and clear `stale` when species/IVs/CP change (write invariant 3); recorded moves are
 * validated against the species pool + fast/charged slot (invariant 2 → 422 `move-not-in-pool`);
 * delete is 204, and both are 404 for a non-owner or unknown id (indistinguishable).
 */
@AutoConfigureMockMvc
class PokemonUpdateDeleteApiTest : IntegrationTest() {
    @Autowired private lateinit var mvc: MockMvc

    @Autowired private lateinit var jdbc: JdbcClient

    private val userA = UUID.randomUUID()
    private val userB = UUID.randomUUID()

    @BeforeEach
    fun seed() = seedCatalog(jdbc)

    private fun user(sub: UUID): RequestPostProcessor =
        jwt()
            .jwt { it.subject(sub.toString()).claim("roles", listOf("user")) }
            .authorities(SimpleGrantedAuthority("ROLE_user"))

    private fun register(
        sub: UUID,
        body: String,
    ): String =
        mvc
            .post("/api/pokemon") {
                contentType = MediaType.APPLICATION_JSON
                content = body
                with(user(sub))
            }.andReturn()
            .response.contentAsString
            .let { Regex("\"id\":\"([^\"]+)\"").find(it)!!.groupValues[1] }

    private fun patch(
        id: String,
        body: String,
        sub: UUID = userA,
    ) = mvc.patch("/api/pokemon/$id") {
        contentType = MediaType.APPLICATION_JSON
        content = body
        with(user(sub))
    }

    @Test
    fun `changing CP re-derives the level and clears the stale flag`() {
        val id = register(userA, """{"speciesId":"VENUSAUR","ivAtk":15,"ivDef":15,"ivSta":15,"cp":2720}""")
        // Force the row stale directly, as the post-sync rescan would (T018).
        jdbc.sql("UPDATE caught_pokemon SET stale = true WHERE id = :id::uuid").param("id", id).update()

        // Venusaur 15/15/15 at CP 2332 resolves to level 30.
        patch(id, """{"cp":2332}""").andExpect {
            status { isOk() }
            jsonPath("$.cp") { value(2332) }
            jsonPath("$.derived.level") { value(30.0) }
            jsonPath("$.stale") { value(false) }
        }
    }

    @Test
    fun `recording a valid move from the pool succeeds`() {
        val id = register(userA, """{"speciesId":"VENUSAUR","ivAtk":15,"ivDef":15,"ivSta":15,"cp":2720}""")

        patch(id, """{"fastMoveId":"VINE_WHIP_FAST","chargedMove1Id":"FRENZY_PLANT"}""").andExpect {
            status { isOk() }
            jsonPath("$.moves.fast.id") { value("VINE_WHIP_FAST") }
            jsonPath("$.moves.charged1.id") { value("FRENZY_PLANT") }
        }
    }

    @Test
    fun `a move outside the species pool is a 422`() {
        val id = register(userA, """{"speciesId":"VENUSAUR","ivAtk":15,"ivDef":15,"ivSta":15,"cp":2720}""")

        patch(id, """{"fastMoveId":"TACKLE_FAST"}""").andExpect {
            status { isUnprocessableContent() }
            jsonPath("$.code") { value("move-not-in-pool") }
        }
    }

    @Test
    fun `a charged move in the fast slot is a 422 (slot correctness)`() {
        val id = register(userA, """{"speciesId":"VENUSAUR","ivAtk":15,"ivDef":15,"ivSta":15,"cp":2720}""")

        // SLUDGE_BOMB is in the pool but is a charged move — invalid in the fast slot.
        patch(id, """{"fastMoveId":"SLUDGE_BOMB"}""").andExpect {
            status { isUnprocessableContent() }
            jsonPath("$.code") { value("move-not-in-pool") }
        }
    }

    @Test
    fun `delete removes the caller's row`() {
        val id = register(userA, """{"speciesId":"VENUSAUR","ivAtk":15,"ivDef":15,"ivSta":15,"cp":2720}""")

        mvc.delete("/api/pokemon/$id") { with(user(userA)) }.andExpect { status { isNoContent() } }
        mvc.get("/api/pokemon/$id") { with(user(userA)) }.andExpect { status { isNotFound() } }
    }

    @Test
    fun `patch and delete of another user's row are 404`() {
        val id = register(userA, """{"speciesId":"VENUSAUR","ivAtk":15,"ivDef":15,"ivSta":15,"cp":2720}""")

        patch(id, """{"cp":2013}""", sub = userB).andExpect { status { isNotFound() } }
        mvc.delete("/api/pokemon/$id") { with(user(userB)) }.andExpect { status { isNotFound() } }
    }

    @Test
    fun `patch and delete of an unknown id are 404`() {
        val unknown = UUID.randomUUID()
        patch(unknown.toString(), """{"cp":2013}""").andExpect { status { isNotFound() } }
        mvc.delete("/api/pokemon/$unknown") { with(user(userA)) }.andExpect { status { isNotFound() } }
    }
}
