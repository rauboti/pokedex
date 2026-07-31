package no.rauboti.pokedex.common

import org.springframework.http.HttpStatus
import org.springframework.http.ProblemDetail
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

/**
 * Translates pokedex's domain exceptions into RFC-7807 problem details. Spring's own MVC exceptions
 * render the same way (`spring.mvc.problemdetails.enabled`), so the error envelope is uniform.
 */
@RestControllerAdvice
class ApiExceptionHandler {
    @ExceptionHandler(BadRequestException::class)
    fun handleBadRequest(ex: BadRequestException): ProblemDetail = problem(HttpStatus.BAD_REQUEST, ex)

    @ExceptionHandler(NotFoundException::class)
    fun handleNotFound(ex: NotFoundException): ProblemDetail = problem(HttpStatus.NOT_FOUND, ex)

    @ExceptionHandler(ForbiddenException::class)
    fun handleForbidden(ex: ForbiddenException): ProblemDetail = problem(HttpStatus.FORBIDDEN, ex)

    @ExceptionHandler(UnprocessableException::class)
    fun handleUnprocessable(ex: UnprocessableException): ProblemDetail = problem(HttpStatus.UNPROCESSABLE_ENTITY, ex)

    @ExceptionHandler(HiveUnavailableException::class)
    fun handleHiveUnavailable(ex: HiveUnavailableException): ProblemDetail = problem(HttpStatus.BAD_GATEWAY, ex)

    @ExceptionHandler(GamedataUnavailableException::class)
    fun handleGamedataUnavailable(ex: GamedataUnavailableException): ProblemDetail = problem(HttpStatus.BAD_GATEWAY, ex)

    private fun problem(
        status: HttpStatus,
        ex: ApiException,
    ): ProblemDetail =
        ProblemDetail.forStatusAndDetail(status, ex.message ?: status.reasonPhrase).apply {
            setProperty("code", ex.code)
        }
}
