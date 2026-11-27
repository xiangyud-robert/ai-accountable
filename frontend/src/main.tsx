import '@fontsource/instrument-sans/400.css'
import '@fontsource/instrument-sans/500.css'
import '@fontsource/instrument-sans/600.css'
import '@fontsource/instrument-sans/700.css'
import '@fontsource/instrument-serif/400.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import './styles/theme.css'

import { QueryClientProvider } from '@tanstack/react-query'
import { Tooltip } from 'radix-ui'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { router } from './app/App'
import { SessionGate } from './auth/SessionGate'
import { startSession } from './auth/session'
import { Toaster } from './components/Toaster'
import { queryClient } from './lib/api'

void startSession()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Tooltip.Provider delayDuration={300}>
        <SessionGate>
          <RouterProvider router={router} />
        </SessionGate>
        <Toaster />
      </Tooltip.Provider>
    </QueryClientProvider>
  </StrictMode>,
)
