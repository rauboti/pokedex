import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { server } from '@/mocks/server'

// Highcharts reaches for a couple of browser APIs jsdom doesn't implement — `CSS.supports` on
// import and `SVGElement.getBBox` on render — so even importing a chart module throws without these.
// (Chart wrappers are stubbed in tests; these keep the underlying libs loadable regardless.)
const globalCss = globalThis as unknown as {
  CSS?: { supports?: (...args: string[]) => boolean }
}
globalCss.CSS ??= {}
if (typeof globalCss.CSS.supports !== 'function') {
  globalCss.CSS.supports = () => false
}
const svgProto = SVGElement.prototype as unknown as { getBBox?: () => DOMRect }
if (typeof svgProto.getBBox !== 'function') {
  svgProto.getBBox = () =>
    ({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      toJSON: () => ({}),
    }) as DOMRect
}

// jsdom ships neither of these, but Chakra (responsive props) and next-themes
// (prefers-color-scheme) both reach for them on render. Re-applied each test and
// defaulted to the light scheme for deterministic colour-mode tests.
beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  )
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})

// MSW: assert against mocked endpoints, fail loudly on any un-mocked request.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  cleanup()
  server.resetHandlers()
  vi.unstubAllGlobals()
})
afterAll(() => server.close())
