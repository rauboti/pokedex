package no.rauboti.pokedex.pokemon

import org.springframework.jdbc.core.simple.JdbcClient

/**
 * Shared catalog seed for the Pokémon CRUD tests: a registrable dual-type (Venusaur) with a
 * three-move pool (one fast, two charged), its non-registrable mega, a low-stat species for the
 * CP-floor collision (Magikarp), and a fast move deliberately left *out* of Venusaur's pool
 * (Tackle) to exercise the move-pool write invariant.
 */
fun seedCatalog(jdbc: JdbcClient) {
    jdbc.sql("truncate table caught_pokemon, species_move, species, move").update()

    fun species(
        id: String,
        dexNr: Int,
        name: String,
        atk: Int,
        def: Int,
        sta: Int,
        type1: String,
        type2: String?,
        registrable: Boolean,
        form: String? = null,
    ) {
        jdbc
            .sql(
                """
                INSERT INTO species (id, dex_nr, name, form, base_atk, base_def, base_sta,
                                     type_1, type_2, registrable, synced_at)
                VALUES (:id, :dex, :name, :form, :atk, :def, :sta, :t1, :t2, :reg, now())
                """.trimIndent(),
            ).param("id", id)
            .param("dex", dexNr)
            .param("name", name)
            .param("form", form)
            .param("atk", atk)
            .param("def", def)
            .param("sta", sta)
            .param("t1", type1)
            .param("t2", type2)
            .param("reg", registrable)
            .update()
    }

    fun move(
        id: String,
        name: String,
        type: String,
        isFast: Boolean,
    ) {
        jdbc
            .sql(
                """
                INSERT INTO move (id, name, type, is_fast, power, energy, duration_ms, synced_at)
                VALUES (:id, :name, :type, :fast, 10, 10, 1000, now())
                """.trimIndent(),
            ).param("id", id)
            .param("name", name)
            .param("type", type)
            .param("fast", isFast)
            .update()
    }

    fun pool(
        speciesId: String,
        moveId: String,
        legacy: Boolean = false,
    ) {
        jdbc
            .sql("INSERT INTO species_move (species_id, move_id, legacy) VALUES (:sid, :mid, :legacy)")
            .param("sid", speciesId)
            .param("mid", moveId)
            .param("legacy", legacy)
            .update()
    }

    species("VENUSAUR", 3, "Venusaur", 198, 189, 190, "Grass", "Poison", registrable = true)
    species("VENUSAUR_MEGA", 3, "Venusaur", 241, 246, 190, "Grass", "Poison", registrable = false, form = "Mega")
    species("MAGIKARP", 129, "Magikarp", 29, 85, 85, "Water", null, registrable = true)

    move("VINE_WHIP_FAST", "Vine Whip", "Grass", isFast = true)
    move("FRENZY_PLANT", "Frenzy Plant", "Grass", isFast = false)
    move("SLUDGE_BOMB", "Sludge Bomb", "Poison", isFast = false)
    move("TACKLE_FAST", "Tackle", "Normal", isFast = true) // NOT in Venusaur's pool

    pool("VENUSAUR", "VINE_WHIP_FAST")
    pool("VENUSAUR", "FRENZY_PLANT", legacy = true)
    pool("VENUSAUR", "SLUDGE_BOMB")
}
