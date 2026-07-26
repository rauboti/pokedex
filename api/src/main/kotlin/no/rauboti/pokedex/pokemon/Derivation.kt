package no.rauboti.pokedex.pokemon

/** `POST /api/derivation` request body (contract `DerivationRequest`). */
data class DerivationRequest(
    val speciesId: String,
    val ivAtk: Int,
    val ivDef: Int,
    val ivSta: Int,
    val cp: Int,
)

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

/** `POST /api/derivation` result (contract `DerivationResult`). Empty `candidates` = impossible. */
data class DerivationResult(
    val candidates: List<DerivationCandidate>,
)
