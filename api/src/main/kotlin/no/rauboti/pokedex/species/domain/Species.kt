package no.rauboti.pokedex.species.domain

import java.time.Instant

/**
 * A species+form as the API exposes it (contract `Species`). `types` is the 1–2 element list built from
 * `type_1`/`type_2`; `form` is null for the base form, as are the sprite URLs and `rarity` when the
 * feed ships none.
 */
data class Species(
    val id: String,
    val dexNr: Int,
    val name: String,
    val form: String?,
    val types: List<String>,
    val baseAtk: Int,
    val baseDef: Int,
    val baseSta: Int,
    val imageUrl: String?,
    val shinyImageUrl: String?,
    val rarity: String?,
    val syncedAt: Instant,
)
