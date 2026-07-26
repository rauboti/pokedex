package no.rauboti.pokedex.catalog.sync.domain

/**
 * The normalized game-data catalog — the output of [no.rauboti.pokedex.catalog.sync.GamedataNormalizer], ready for [no.rauboti.pokedex.catalog.sync.SyncService] to
 * upsert. Plain domain rows decoupled from the source feed's JSON shape: [moves] is deduplicated by
 * id (a move known by many species is one row), while [pool] carries one entry per (species, move)
 * with the legacy/Elite-TM flag that belongs to the pairing, not the move.
 */
data class NormalizedCatalog(
    val species: List<NormalizedSpecies>,
    val moves: List<NormalizedMove>,
    val pool: List<NormalizedPoolEntry>,
)
