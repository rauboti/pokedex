package no.rauboti.pokedex.catalog.sync.domain

/** One species+form row. Megas and temporary battle forms are `registrable=false`. */
data class NormalizedSpecies(
    val id: String,
    val dexNr: Int,
    val name: String,
    val form: String?,
    val baseAtk: Int,
    val baseDef: Int,
    val baseSta: Int,
    val type1: String,
    val type2: String?,
    val registrable: Boolean,
    val imageUrl: String?,
    val shinyImageUrl: String?,
    /** Rarity/class from the feed's `pokemonClass` ("Legendary"/"Mythic"/"Ultra Beast"), or null. */
    val rarity: String?,
)
