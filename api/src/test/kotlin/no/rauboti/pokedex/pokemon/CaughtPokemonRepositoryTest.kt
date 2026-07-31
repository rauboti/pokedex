package no.rauboti.pokedex.pokemon

import no.rauboti.pokedex.caughtpokemon.CaughtPokemonService
import no.rauboti.pokedex.caughtpokemon.domain.CaughtBasePokemon
import no.rauboti.pokedex.support.IntegrationTest
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.jdbc.core.simple.JdbcClient
import java.time.LocalDate

/**
 * The player-owned CaughtPokemon repository (US1): insert/list/find/update/delete round-trips over a
 * real Postgres (Testcontainers), every read scoped by `user_id` (FR-014). Rows reference a seeded
 * species (FK); the V2 CHECK constraints reject out-of-range IVs/CP at the DB layer; the `stale` flag
 * and nullable move-slot FKs round-trip; `findAll` + `markAsStale` back the post-sync rescan.
 */
class CaughtPokemonRepositoryTest : IntegrationTest() {
    @Autowired private lateinit var caughtPokemonService: CaughtPokemonService

    @Autowired private lateinit var jdbc: JdbcClient

    private val userA = "user-a"
    private val userB = "user-b"

    @BeforeEach
    fun seed() {
        jdbc.sql("truncate table caught_pokemon, species_move, species, move").update()
        jdbc
            .sql(
                """
                INSERT INTO species (id, dex_nr, name, form, base_atk, base_def, base_sta,
                                     type_1, type_2, registrable, synced_at)
                VALUES ('VENUSAUR', 3, 'Venusaur', NULL, 198, 189, 190, 'Grass', 'Poison', true, now())
                """.trimIndent(),
            ).update()
        jdbc
            .sql(
                """
                INSERT INTO move (id, name, type, is_fast, power, energy, duration_ms, synced_at)
                VALUES ('VINE_WHIP_FAST', 'Vine Whip', 'Grass', true, 7, 6, 600, now())
                """.trimIndent(),
            ).update()
    }

    private fun newPokemon(
        userId: String = userA,
        ivAtk: Int = 15,
        ivDef: Int = 15,
        ivSta: Int = 15,
        cp: Int = 2087,
        level: Double = 25.0,
        stale: Boolean = false,
        fastMoveId: String? = null,
        caughtAt: LocalDate? = LocalDate.of(2026, 7, 10),
    ) = CaughtBasePokemon(
        userId = userId,
        speciesId = "VENUSAUR",
        ivAtk = ivAtk,
        ivDef = ivDef,
        ivSta = ivSta,
        cp = cp,
        level = level,
        stale = stale,
        fastMoveId = fastMoveId,
        caughtAt = caughtAt,
    )

    @Test
    fun `insert then find round-trips every field`() {
        val saved = caughtPokemonService.save(newPokemon(fastMoveId = "VINE_WHIP_FAST"))

        val found = caughtPokemonService.findByUserIdAndId(saved.id, userA)
        assertThat(found).isNotNull
        assertThat(found!!.speciesId).isEqualTo("VENUSAUR")
        assertThat(found.ivAtk).isEqualTo(15)
        assertThat(found.cp).isEqualTo(2087)
        assertThat(found.level).isEqualTo(25.0)
        assertThat(found.fastMoveId).isEqualTo("VINE_WHIP_FAST")
        assertThat(found.charged1MoveId).isNull()
        assertThat(found.caughtAt).isEqualTo(LocalDate.of(2026, 7, 10))
        assertThat(found.createdAt).isNotNull()
    }

    @Test
    fun `reads are scoped to the owner`() {
        val a = caughtPokemonService.save(newPokemon(userId = userA))
        caughtPokemonService.save(newPokemon(userId = userB))

        assertThat(caughtPokemonService.findByUserId(userA).map { it.id }).containsExactly(a.id)
        // A's row is invisible to B — findByUserIdAndId with the wrong owner yields null (404-worthy).
        assertThat(caughtPokemonService.findByUserIdAndId(a.id, userB)).isNull()
    }

    @Test
    fun `update changes fields for the owner and is a no-op for a non-owner`() {
        val saved = caughtPokemonService.save(newPokemon(userId = userA, cp = 2087, stale = false))

        val updated = caughtPokemonService.update(saved.copy(cp = 2100, level = 26.0, stale = true))
        assertThat(updated).isNotNull
        assertThat(updated!!.cp).isEqualTo(2100)
        assertThat(updated.level).isEqualTo(26.0)
        assertThat(updated.stale).isTrue()

        // A different owner can't update the row.
        assertThat(caughtPokemonService.update(saved.copy(userId = userB, cp = 9999))).isNull()
        assertThat(caughtPokemonService.findByUserIdAndId(saved.id, userA)!!.cp).isEqualTo(2100)
    }

    @Test
    fun `delete removes the owner's row and is a no-op for a non-owner`() {
        val saved = caughtPokemonService.save(newPokemon(userId = userA))

        assertThat(caughtPokemonService.delete(saved.id, userB)).isFalse()
        assertThat(caughtPokemonService.findByUserIdAndId(saved.id, userA)).isNotNull()

        assertThat(caughtPokemonService.delete(saved.id, userA)).isTrue()
        assertThat(caughtPokemonService.findByUserIdAndId(saved.id, userA)).isNull()
    }

    @Test
    fun `the DB rejects an out-of-range IV`() {
        assertThatThrownBy { caughtPokemonService.save(newPokemon(ivAtk = 16)) }
            .isInstanceOf(DataIntegrityViolationException::class.java)
    }

    @Test
    fun `the DB rejects a CP below the floor`() {
        assertThatThrownBy { caughtPokemonService.save(newPokemon(cp = 9)) }
            .isInstanceOf(DataIntegrityViolationException::class.java)
    }

    @Test
    fun `the stale flag round-trips and markStale flips it for the listed ids`() {
        val fresh = caughtPokemonService.save(newPokemon(userId = userA, stale = false))
        val alreadyStale = caughtPokemonService.save(newPokemon(userId = userA, stale = true))
        assertThat(caughtPokemonService.findByUserIdAndId(alreadyStale.id, userA)!!.stale).isTrue()

        caughtPokemonService.markAsStale(listOf(fresh.id))

        assertThat(caughtPokemonService.findByUserIdAndId(fresh.id, userA)!!.stale).isTrue()
    }

    @Test
    fun `listAll returns every user's rows (for the post-sync rescan)`() {
        caughtPokemonService.save(newPokemon(userId = userA))
        caughtPokemonService.save(newPokemon(userId = userB))

        assertThat(caughtPokemonService.findAll()).hasSize(2)
    }
}
