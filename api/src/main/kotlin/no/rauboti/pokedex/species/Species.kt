package no.rauboti.pokedex.species

import java.time.Instant

/**
 * A species+form as the API exposes it (contract schema `Species`, US1). `types` is the 1–2 element
 * list assembled from the catalog's `type_1`/`type_2`; `form` is null for the base form. Base stats
 * come straight from the synced catalog (the web app does no stat math — research D7).
 * `imageUrl`/`shinyImageUrl` are the synced sprite URLs (null when the feed ships none for a form).
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
    val syncedAt: Instant,
)
