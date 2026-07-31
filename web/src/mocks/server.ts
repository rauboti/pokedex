import { setupServer } from 'msw/node'
import { handlers } from './handlers'

/** Lifecycle is driven from `src/test/setup.ts`; tests override handlers with `server.use(...)`. */
export const server = setupServer(...handlers)
