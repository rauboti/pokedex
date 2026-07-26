package no.rauboti.pokedex.catalog.sync.domain

/** One species-can-know-move pairing (data-model `species_move`); `legacy` = not normally obtainable. */
data class NormalizedPoolEntry(
    val speciesId: String,
    val moveId: String,
    val legacy: Boolean,
)
