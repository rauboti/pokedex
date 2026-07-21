package no.rauboti.pokedex.common

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

/**
 * Plain unit test of the exception → ProblemDetail mapping: HTTP status, human-readable
 * `detail`, and the stable machine-readable `code` the web app maps to messages (the web
 * Zod `Problem` schema carries `code`, T011). Mirrors avec's common test; pokedex diverges
 * by mapping 422 (UnprocessableException) instead of avec's 409, and carries a second 502
 * for the game-data source alongside hive.
 */
class ApiExceptionHandlerTest {
    private val handler = ApiExceptionHandler()

    @Test
    fun `maps BadRequestException to 400 with detail and code`() {
        val problem = handler.handleBadRequest(BadRequestException("iv-out-of-range", "iv must be between 0 and 15"))
        assertThat(problem.status).isEqualTo(400)
        assertThat(problem.detail).isEqualTo("iv must be between 0 and 15")
        assertThat(problem.properties?.get("code")).isEqualTo("iv-out-of-range")
    }

    @Test
    fun `maps NotFoundException to 404 with detail and code`() {
        val problem = handler.handleNotFound(NotFoundException("unknown-species", "no species with that id"))
        assertThat(problem.status).isEqualTo(404)
        assertThat(problem.detail).isEqualTo("no species with that id")
        assertThat(problem.properties?.get("code")).isEqualTo("unknown-species")
    }

    @Test
    fun `maps ForbiddenException to 403 with detail and code`() {
        val problem = handler.handleForbidden(ForbiddenException("admin-only", "catalog sync requires the admin role"))
        assertThat(problem.status).isEqualTo(403)
        assertThat(problem.detail).isEqualTo("catalog sync requires the admin role")
        assertThat(problem.properties?.get("code")).isEqualTo("admin-only")
    }

    @Test
    fun `maps UnprocessableException to 422 with detail and code`() {
        val problem =
            handler.handleUnprocessable(
                UnprocessableException("impossible-combination", "no level yields that CP for those IVs"),
            )
        assertThat(problem.status).isEqualTo(422)
        assertThat(problem.detail).isEqualTo("no level yields that CP for those IVs")
        assertThat(problem.properties?.get("code")).isEqualTo("impossible-combination")
    }

    @Test
    fun `maps HiveUnavailableException to 502 with detail and code`() {
        val problem = handler.handleHiveUnavailable(HiveUnavailableException("hive-unavailable", "hive is unreachable"))
        assertThat(problem.status).isEqualTo(502)
        assertThat(problem.detail).isEqualTo("hive is unreachable")
        assertThat(problem.properties?.get("code")).isEqualTo("hive-unavailable")
    }

    @Test
    fun `maps GamedataUnavailableException to 502 with detail and code`() {
        val problem =
            handler.handleGamedataUnavailable(
                GamedataUnavailableException("gamedata-unavailable", "the game-data source is unreachable"),
            )
        assertThat(problem.status).isEqualTo(502)
        assertThat(problem.detail).isEqualTo("the game-data source is unreachable")
        assertThat(problem.properties?.get("code")).isEqualTo("gamedata-unavailable")
    }
}
