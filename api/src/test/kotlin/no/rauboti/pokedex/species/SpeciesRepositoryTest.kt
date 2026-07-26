package no.rauboti.pokedex.species

import no.rauboti.pokedex.support.IntegrationTest
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.jdbc.core.simple.JdbcClient

/**
 * The species search repository (US1): case-insensitive substring match on name, restricted to
 * **registrable** species (mega/temporary battle forms excluded — clarification 2026-07-20), ordered
 * by dex number then form, honouring the result limit. Rows are seeded directly (a live sync isn't
 * needed to exercise search).
 */
class SpeciesRepositoryTest : IntegrationTest() {
    @Autowired private lateinit var speciesRepo: SpeciesRepository

    @Autowired private lateinit var jdbc: JdbcClient

    @BeforeEach
    fun clean() {
        jdbc.sql("truncate table caught_pokemon, species_move, species, move").update()
    }

    private fun seed(
        id: String,
        dexNr: Int,
        name: String,
        form: String?,
        type1: String,
        type2: String?,
        registrable: Boolean = true,
        rarity: String? = null,
    ) {
        jdbc
            .sql(
                """
                insert into species (id, dex_nr, name, form, base_atk, base_def, base_sta,
                                     type_1, type_2, registrable, rarity, synced_at)
                values (:id, :dex, :name, :form, 100, 100, 100, :t1, :t2, :reg, :rarity, now())
                """.trimIndent(),
            ).param("id", id)
            .param("dex", dexNr)
            .param("name", name)
            .param("form", form)
            .param("t1", type1)
            .param("t2", type2)
            .param("reg", registrable)
            .param("rarity", rarity)
            .update()
    }

    @Test
    fun `matches a case-insensitive name substring`() {
        seed("VENUSAUR", 3, "Venusaur", null, "Grass", "Poison")
        seed("CHARMANDER", 4, "Charmander", null, "Fire", null)

        assertThat(speciesRepo.search("venu", 20).map { it.id }).containsExactly("VENUSAUR")
        assertThat(speciesRepo.search("VENU", 20).map { it.id }).containsExactly("VENUSAUR")
        assertThat(speciesRepo.search("mander", 20).map { it.id }).containsExactly("CHARMANDER")
    }

    @Test
    fun `includes forms and orders by dex number then form (base before named forms)`() {
        seed("RATTATA_ALOLA", 19, "Rattata", "Alola", "Dark", "Normal")
        seed("RATTATA", 19, "Rattata", null, "Normal", null)
        seed("PIDGEY", 16, "Pidgey", null, "Normal", "Flying")

        // Pidgey (dex 16) before both Rattata rows (dex 19); base Rattata (null form) before Alola.
        assertThat(speciesRepo.search("", 20).map { it.id })
            .containsExactly("PIDGEY", "RATTATA", "RATTATA_ALOLA")
    }

    @Test
    fun `never returns non-registrable species (mega, temporary forms)`() {
        seed("VENUSAUR", 3, "Venusaur", null, "Grass", "Poison")
        seed("VENUSAUR_MEGA", 3, "Venusaur", "Mega", "Grass", "Poison", registrable = false)

        assertThat(speciesRepo.search("venusaur", 20).map { it.id }).containsExactly("VENUSAUR")
    }

    @Test
    fun `honours the result limit`() {
        seed("BULBASAUR", 1, "Bulbasaur", null, "Grass", "Poison")
        seed("IVYSAUR", 2, "Ivysaur", null, "Grass", "Poison")
        seed("VENUSAUR", 3, "Venusaur", null, "Grass", "Poison")

        assertThat(speciesRepo.search("saur", 2)).hasSize(2)
        assertThat(speciesRepo.search("saur", 2).map { it.id }).containsExactly("BULBASAUR", "IVYSAUR")
    }

    @Test
    fun `assembles the types list from type_1 and type_2 (single-type has one entry)`() {
        seed("VENUSAUR", 3, "Venusaur", null, "Grass", "Poison")
        seed("CHARMANDER", 4, "Charmander", null, "Fire", null)

        assertThat(speciesRepo.search("venusaur", 20).single().types).containsExactly("Grass", "Poison")
        assertThat(speciesRepo.search("charmander", 20).single().types).containsExactly("Fire")
    }

    @Test
    fun `carries the synced rarity, null for an ordinary species`() {
        seed("MEWTWO", 150, "Mewtwo", null, "Psychic", null, rarity = "Legendary")
        seed("CHARMANDER", 4, "Charmander", null, "Fire", null)

        assertThat(speciesRepo.search("mewtwo", 20).single().rarity).isEqualTo("Legendary")
        assertThat(speciesRepo.search("charmander", 20).single().rarity).isNull()
    }
}
