import { z } from 'zod'

/** A full-page navigation, not XHR — so it can never be a client route. */
export const LOGIN_PATH = '/auth/login'

/** Callers pass resource-relative paths (`/auth/me`, `/pokemon`). */
const API_BASE = '/api'

/** RFC-7807 problem details. Every field is optional so an unexpected error body still parses;
 *  `code` is the stable machine identifier the UI keys on. */
export const problemSchema = z.object({
  type: z.string().optional(),
  title: z.string().optional(),
  status: z.number().optional(),
  detail: z.string().optional(),
  instance: z.string().optional(),
  code: z.string().optional(),
})
export type Problem = z.infer<typeof problemSchema>

/** Thrown for any non-2xx response, carrying the status and any parsed problem details. */
export class ApiError extends Error {
  readonly status: number
  readonly problem?: Problem

  constructor(status: number, problem?: Problem, message?: string) {
    super(
      message ??
        problem?.detail ??
        problem?.title ??
        `API request failed (${status})`,
    )
    this.name = 'ApiError'
    this.status = status
    this.problem = problem
  }
}

/**
 * Registered by the AuthProvider so any 403 drops the app to the no-access screen, whichever data
 * call surfaced it. `null` clears the handler.
 */
let onForbidden: (() => void) | null = null
export const setOnForbidden = (handler: (() => void) | null): void => {
  onForbidden = handler
}

export type ApiRequestOptions = {
  method?: string
  /** Serialized to JSON and sent with `Content-Type: application/json`. */
  body?: unknown
  signal?: AbortSignal
  /** Pass `false` for the bootstrap probe, so it can render a login screen instead. */
  redirectOnUnauthorized?: boolean
  /** Pass `false` for the bootstrap probe, which resolves its own no-access state. */
  notifyForbidden?: boolean
}

const readProblem = async (
  response: Response,
): Promise<Problem | undefined> => {
  if (!response.headers.get('content-type')?.includes('json')) return undefined
  try {
    return problemSchema.parse(await response.json())
  } catch {
    return undefined
  }
}

/**
 * Typed fetch wrapper: sends the session cookie, validates the body against `schema` (use
 * `z.undefined()` for 204s), and turns every failure into an `ApiError`. See the web README
 * ("Auth flow") for the 401/403 handling.
 */
export const apiRequest = async <T>(
  path: string,
  schema: z.ZodType<T>,
  options: ApiRequestOptions = {},
): Promise<T> => {
  const {
    method,
    body,
    signal,
    redirectOnUnauthorized = true,
    notifyForbidden = true,
  } = options

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const response = await fetch(`${API_BASE}${path}`, {
    method: method ?? (body !== undefined ? 'POST' : 'GET'),
    headers,
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  })

  if (response.status === 401) {
    const problem = await readProblem(response)
    if (redirectOnUnauthorized) window.location.assign(LOGIN_PATH)
    throw new ApiError(401, problem)
  }

  if (response.status === 403) {
    const problem = await readProblem(response)
    if (notifyForbidden) onForbidden?.()
    throw new ApiError(403, problem)
  }

  if (!response.ok) {
    throw new ApiError(response.status, await readProblem(response))
  }

  const data =
    response.status === 204 || response.headers.get('content-length') === '0'
      ? undefined
      : await response.json()

  return schema.parse(data)
}
