package no.rauboti.pokedex.derivation.domain

/** `POST /api/derivation` result (contract `DerivationResult`). Empty `candidates` = impossible. */
data class DerivationResult(
    val candidates: List<DerivationCandidate>,
)
