package no.rauboti.pokedex.auth

import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64

/**
 * PKCE (RFC 7636) + CSRF-`state` primitives. pokedex is the OAuth *client*: the `code_verifier` stays
 * server-side and only the S256 `code_challenge` goes to hive.
 */
object Pkce {
    private val secureRandom = SecureRandom()
    private val urlEncoder = Base64.getUrlEncoder().withoutPadding()

    /** A high-entropy, URL-safe token — used for the PKCE verifier and the `state` value. */
    fun randomToken(bytes: Int = 32): String {
        val buffer = ByteArray(bytes).also(secureRandom::nextBytes)
        return urlEncoder.encodeToString(buffer)
    }

    /** The S256 challenge for [verifier]: `base64url(sha256(verifier))`, unpadded. */
    fun challenge(verifier: String): String =
        urlEncoder.encodeToString(
            MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray(Charsets.US_ASCII)),
        )
}
