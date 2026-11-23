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
import { Toaster } from './components/Toaster'
import { queryClient } from './lib/api'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Tooltip.Provider delayDuration={300}>
        <RouterProvider router={router} />
        <Toaster />
      </Tooltip.Provider>
    </QueryClientProvider>
  </StrictMode>,
)
