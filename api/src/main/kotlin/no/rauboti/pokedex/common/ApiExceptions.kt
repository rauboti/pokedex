package no.rauboti.pokedex.common

/**
 * Base for pokedex's domain exceptions, carrying the RFC-7807 pair the web app needs:
 * [message] becomes the human-readable `detail`, [code] the stable machine-readable
 * identifier the frontend keys on (the web Zod `Problem` schema carries `code`, T011) —
 * e.g. `unknown-species`, `impossible-combination`, `level-not-a-candidate`,
 * `move-not-in-pool`, `gamedata-unavailable`.
 */
abstract class ApiException(
    val code: String,
    message: String,
    cause: Throwable? = null,
) : RuntimeException(message, cause)

/** 400 — the request is invalid: missing query, IV/CP out of range, malformed input. */
class BadRequestException(
    code: String,
    message: String,
) : ApiException(code, message)

/** 404 — the resource does not exist, or is not owned by the caller (indistinguishable by design). */
class NotFoundException(
    code: String,
    message: String,
) : ApiException(code, message)

/** 403 — the caller is authenticated but not permitted (e.g. catalog sync is admin-only). */
class ForbiddenException(
    code: String,
    message: String,
) : ApiException(code, message)

/**
 * 422 — the input is well-formed but cannot be processed: an impossible species/IV/CP
 * combination, a level not among the solver's candidates, a non-registrable species, or a
 * move outside the species pool (SC-004; pokedex's divergence from avec's 409).
 */
class UnprocessableException(
    code: String,
    message: String,
) : ApiException(code, message)

/** 502 — hive (the identity provider) is unreachable or returned an unusable response. */
class HiveUnavailableException(
    code: String,
    message: String,
    cause: Throwable? = null,
) : ApiException(code, message, cause)

/** 502 — the game-data source is unreachable or returned an unusable response (research D5). */
class GamedataUnavailableException(
    code: String,
    message: String,
    cause: Throwable? = null,
) : ApiException(code, message, cause)
