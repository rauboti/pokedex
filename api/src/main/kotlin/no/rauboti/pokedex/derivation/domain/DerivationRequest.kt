package no.rauboti.pokedex.derivation.domain

/** `POST /api/derivation` request body (contract `DerivationRequest`). */
data class DerivationRequest(
    val speciesId: String,
    val ivAtk: Int,
    val ivDef: Int,
    val ivSta: Int,
    val cp: Int,
)