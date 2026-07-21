package no.rauboti.pokedex.gamedata

import no.rauboti.pokedex.common.GamedataUnavailableException
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test

/**
 * Pure test of the feed → domain normalization (research D5), against committed fixture JSON
 * mirroring the real pokemon-go-api.github.io shape (source URLs recorded in research.md D5): species
 * incl. regional forms and megas, embedded fast/charged move pools with legacy/Elite-TM markers, the
 * empty-elite-collection `[]` quirk, and both a malformed species and a malformed move that must be
 * skipped rather than fail the whole feed. No Spring, no DB.
 */
class GamedataNormalizerTest {
    private val normalizer = GamedataNormalizer()

    private val feed: String =
        checkNotNull(javaClass.getResource("/gamedata/pokedex-fixture.json")) {
            "fixture missing"
        }.readText()

    private val catalog by lazy { normalizer.normalize(feed) }

    private fun species(id: String) = catalog.species.single { it.id == id }

    @Test
    fun `normalizes registrable base species with dual types`() {
        val venusaur = species("VENUSAUR")
        assertThat(venusaur.dexNr).isEqualTo(3)
        assertThat(venusaur.name).isEqualTo("Venusaur")
        assertThat(venusaur.form).isNull()
        assertThat(venusaur.baseAtk).isEqualTo(198)
        assertThat(venusaur.baseDef).isEqualTo(189)
        assertThat(venusaur.baseSta).isEqualTo(190)
        assertThat(venusaur.type1).isEqualTo("Grass")
        assertThat(venusaur.type2).isEqualTo("Poison")
        assertThat(venusaur.registrable).isTrue()
    }

    @Test
    fun `flags mega evolutions non-registrable with their own stats and a form label`() {
        val mega = species("VENUSAUR_MEGA")
        assertThat(mega.registrable).isFalse()
        assertThat(mega.form).isEqualTo("Mega")
        assertThat(mega.dexNr).isEqualTo(3) // inherited from the base entry
        assertThat(mega.baseAtk).isEqualTo(241)
    }

    @Test
    fun `expands regional forms as their own registrable rows with the inherited dex number`() {
        val alolan = species("RATTATA_ALOLA")
        assertThat(alolan.registrable).isTrue()
        assertThat(alolan.form).isEqualTo("Alola")
        assertThat(alolan.dexNr).isEqualTo(19)
        assertThat(alolan.type1).isEqualTo("Dark")
        assertThat(alolan.type2).isEqualTo("Normal")
    }

    @Test
    fun `leaves type2 null for single-type species`() {
        assertThat(species("CHARMANDER").type2).isNull()
    }

    @Test
    fun `captures sprite URLs from the feed assets block, null when absent`() {
        val venusaur = species("VENUSAUR")
        assertThat(venusaur.imageUrl).isEqualTo("https://example.test/assets/Pokemon/pm3.icon.png")
        assertThat(venusaur.shinyImageUrl).isEqualTo("https://example.test/assets/Pokemon/pm3.s.icon.png")
        // CHARMANDER's fixture entry has no `assets` → both null (the web falls back to the name).
        assertThat(species("CHARMANDER").imageUrl).isNull()
        assertThat(species("CHARMANDER").shinyImageUrl).isNull()
    }

    @Test
    fun `skips malformed species without failing the feed`() {
        // BROKEN_SPECIES has no stats; the rest still normalize.
        assertThat(catalog.species.map { it.id })
            .containsExactlyInAnyOrder("VENUSAUR", "VENUSAUR_MEGA", "RATTATA", "RATTATA_ALOLA", "CHARMANDER")
    }

    @Test
    fun `deduplicates moves by id across species but keeps a pool row per species`() {
        // QUICK_ATTACK_FAST is on both RATTATA and RATTATA_ALOLA — one move row, two pool rows.
        assertThat(catalog.moves.count { it.id == "QUICK_ATTACK_FAST" }).isEqualTo(1)
        assertThat(catalog.pool.count { it.moveId == "QUICK_ATTACK_FAST" }).isEqualTo(2)
    }

    @Test
    fun `parses fast and charged moves with power, energy and duration`() {
        val razorLeaf = catalog.moves.single { it.id == "RAZOR_LEAF_FAST" }
        assertThat(razorLeaf.isFast).isTrue()
        assertThat(razorLeaf.type).isEqualTo("Grass")
        assertThat(razorLeaf.power).isEqualTo(13.0)
        assertThat(razorLeaf.energy).isEqualTo(7.0)
        assertThat(razorLeaf.durationMs).isEqualTo(1000)

        val sludge = catalog.moves.single { it.id == "SLUDGE_BOMB" }
        assertThat(sludge.isFast).isFalse()
        assertThat(sludge.energy).isEqualTo(-50.0)
    }

    @Test
    fun `marks Elite-TM charged moves legacy in the pool`() {
        val frenzy = catalog.pool.single { it.speciesId == "VENUSAUR" && it.moveId == "FRENZY_PLANT" }
        assertThat(frenzy.legacy).isTrue()
        assertThat(catalog.moves.single { it.id == "FRENZY_PLANT" }.isFast).isFalse()

        // Non-elite moves are not legacy.
        val razor = catalog.pool.single { it.speciesId == "VENUSAUR" && it.moveId == "RAZOR_LEAF_FAST" }
        assertThat(razor.legacy).isFalse()
    }

    @Test
    fun `skips a malformed move without dropping the species`() {
        // CHARMANDER's BROKEN_MOVE lacks power/duration; FLAME_CHARGE and the species survive.
        assertThat(catalog.moves.none { it.id == "BROKEN_MOVE" }).isTrue()
        assertThat(catalog.pool.filter { it.speciesId == "CHARMANDER" }.map { it.moveId })
            .containsExactlyInAnyOrder("SCRATCH_FAST", "FLAME_CHARGE")
    }

    @Test
    fun `a feed whose root is not an array is a 502-worthy failure`() {
        assertThatThrownBy { normalizer.normalize("""{"not":"an array"}""") }
            .isInstanceOf(GamedataUnavailableException::class.java)
        assertThatThrownBy { normalizer.normalize("not even json") }
            .isInstanceOf(GamedataUnavailableException::class.java)
    }
}
