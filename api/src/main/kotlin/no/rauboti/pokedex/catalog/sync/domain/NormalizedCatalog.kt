package no.rauboti.pokedex.catalog.sync.domain

/**
 * The normalizer's output, decoupled from the feed's JSON shape. [moves] is deduplicated by id, while
 * [pool] carries one entry per (species, move) — the legacy flag belongs to the pairing, not the move.
 */
data class NormalizedCatalog(
    val species: List<NormalizedSpecies>,
    val moves: List<NormalizedMove>,
    val pool: List<NormalizedPoolEntry>,
)
