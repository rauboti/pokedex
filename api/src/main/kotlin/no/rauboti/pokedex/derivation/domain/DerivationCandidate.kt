package no.rauboti.pokedex.derivation.domain

/**
 * One CP→level candidate (contract `DerivationResult.candidates[]`). `dustCost` is the power-up
 * stardust at this level — an informational hint shown per candidate. Collisions occur only within
 * the low-level CP-floor plateau, where the dust cost is equal across candidates; the player
 * distinguishes candidates by level.
 */
data class DerivationCandidate(
    val level: Double,
    val hp: Int,
    val attack: Double,
    val defense: Double,
    val stamina: Double,
    val dustCost: Int,
)