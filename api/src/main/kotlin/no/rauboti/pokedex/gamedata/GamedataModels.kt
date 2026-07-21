package no.rauboti.pokedex.gamedata

/**
 * The normalized game-data catalog — the output of [GamedataNormalizer], ready for [SyncService] to
 * upsert. Plain domain rows decoupled from the source feed's JSON shape (research D5): [moves] is
 * deduplicated by id (a move known by many species is one row), while [pool] carries one entry per
 * (species, move) with the legacy/Elite-TM flag that belongs to the pairing, not the move.
 */
data class NormalizedCatalog(
    val species: List<NormalizedSpecies>,
    val moves: List<NormalizedMove>,
    val pool: List<NormalizedPoolEntry>,
)

/** One species+form row (data-model `species`). Megas/temporary battle forms are `registrable=false`.
 *  `imageUrl`/`shinyImageUrl` come from the feed's `assets` and are null when absent (research D5). */
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
)

/** One fast/charged move row (data-model `move`). */
data class NormalizedMove(
    val id: String,
    val name: String,
    val type: String,
    val isFast: Boolean,
    val power: Double,
    val energy: Double,
    val durationMs: Int,
)

/** One species-can-know-move pairing (data-model `species_move`); `legacy` = not normally obtainable. */
data class NormalizedPoolEntry(
    val speciesId: String,
    val moveId: String,
    val legacy: Boolean,
)
