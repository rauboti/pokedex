import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider, GlobalStyles } from '@rauboti/ui'

/** Minimal ThemeProvider shell — routing, auth context, and the MSW hook land
 *  with the web API layer and shell tasks (T011/T012). */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <GlobalStyles />
      <main>Pokedex</main>
    </ThemeProvider>
  </StrictMode>,
)
