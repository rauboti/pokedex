package no.rauboti.pokedex.derivation.domain

/**
 * One CP→level candidate. `dustCost` is a per-candidate hint, *not* the disambiguator: collisions only
 * happen on the low-level CP-floor plateau, where dust is equal across candidates.
 */
data class DerivationCandidate(
    val level: Double,
    val hp: Int,
    val attack: Double,
    val defense: Double,
    val stamina: Double,
    val dustCost: Int,
)
