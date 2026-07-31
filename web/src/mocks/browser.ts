import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

/**
 * The dev-mode MSW worker, started from `main.tsx` only when `VITE_ENABLE_MSW=true`. Requires
 * `public/mockServiceWorker.js` (`yarn msw init public`).
 */
export const worker = setupWorker(...handlers)
